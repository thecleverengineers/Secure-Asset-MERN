import { DriveFile, Property, PropertySpace, PropertyMedia, RentalUnit, Subscription, User } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { publicPropertySlug, serializePublicProperty, serializePublicSpace } from '../services/publicPropertySerialization.js';
import { resolvePropertyMediaFile } from '../services/propertyMediaFile.js';
import { sendStoredFile } from '../utils/httpFile.js';
import { activeVerifiedPublicSurveyorUserIds } from '../services/publicSurveyorEligibility.js';

function escapeRegex(value) { return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function searchExpression(value) { return new RegExp(escapeRegex(String(value || '').trim()), 'i'); }
function isObjectId(value) { return /^[a-f\d]{24}$/i.test(String(value || '')); }
function compact(values) { return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]; }

// Surveyor discovery is live subscription/profile data. Keep browsers, reverse
// proxies, and CDNs from replaying an older directory response after a profile
// or subscription changes.
function setLiveDirectoryHeaders(res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
    'X-Accel-Expires': '0',
  });
}

async function activeLandlordIds() {
  return Subscription.distinct('user', { status: 'active', expiresAt: { $gt: new Date() } });
}

export async function publicPropertyFilter(extra = {}) {
  const activeOwnerIds = await activeLandlordIds();
  return {
    visibility: 'public',
    publicationStatus: 'published',
    status: { $in: ['available', 'partially_occupied', 'occupied', 'reserved', 'rented'] },
    deletedAt: null,
    $and: [{ $or: [{ requiresActiveSubscription: false }, { owner: { $in: activeOwnerIds } }] }],
    ...extra,
  };
}

export const listPublicProperties = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 50);
  const base = await publicPropertyFilter();
  const baseAnd = [...(base.$and || [])];
  delete base.$and;

  const listingType = String(req.query.listingType || (req.query.isSale === 'true' ? 'sale' : req.query.isSale === 'false' ? 'rent' : ''));
  if (req.query.type && req.query.type !== 'all') base.type = String(req.query.type);
  if (req.query.city) base['address.city'] = searchExpression(req.query.city);
  if (req.query.state) base['address.state'] = searchExpression(req.query.state);
  if (req.query.country) base['address.country'] = searchExpression(req.query.country);
  if (req.query.landlord) base.owner = isObjectId(req.query.landlord) ? req.query.landlord : { $in: [] };
  if (req.query.verified === 'true') base.isVerified = true;
  if (req.query.trustedSeller === 'true') {
    const trustedOwnerIds = await User.distinct('_id', { status: 'active', kycStatus: 'verified', landlordEnabled: true });
    if (typeof base.owner === 'string') {
      if (!trustedOwnerIds.some((id) => String(id) === String(base.owner))) base.owner = { $in: [] };
    } else base.owner = { $in: trustedOwnerIds };
  }
  if (['rent', 'sale', 'lease'].includes(listingType)) baseAnd.push({ $or: [{ purpose: listingType }, { listingType }] });
  if ((req.query.minPrice || req.query.maxPrice) && listingType !== 'rent') {
    const range = { ...(req.query.minPrice && { $gte: Number(req.query.minPrice) }), ...(req.query.maxPrice && { $lte: Number(req.query.maxPrice) }) };
    baseAnd.push({ $or: [{ price: range }, { 'pricing.salePrice': range }, { 'pricing.monthlyRent': range }, { 'pricing.leaseAmount': range }] });
  }
  if (req.query.address) {
    const address = searchExpression(req.query.address);
    baseAnd.push({ $or: [
      { 'address.line1': address }, { 'address.line2': address }, { 'address.locality': address }, { 'address.landmark': address }, { 'address.city': address }, { 'address.state': address },
      { 'address.country': address }, { 'address.postalCode': address }, { 'map.locality': address }, { 'map.district': address }, { 'map.landmark': address },
    ] });
  }

  const basePropertyFilter = { ...base, $and: baseAnd };
  const propertyFilter = { ...base, $and: [...baseAnd] };
  const query = String(req.query.search || '').trim();
  let matchedParentIds = [];
  if (query) {
    const expression = searchExpression(query);
    propertyFilter.$and.push({ $or: [
      { title: expression }, { description: expression }, { code: expression }, { referenceNumber: expression },
      { type: expression }, { customType: expression }, { amenities: expression },
      { 'address.line1': expression }, { 'address.line2': expression }, { 'address.locality': expression }, { 'address.landmark': expression }, { 'address.city': expression },
      { 'address.state': expression }, { 'address.country': expression }, { 'address.postalCode': expression },
      { 'map.locality': expression }, { 'map.district': expression }, { 'map.landmark': expression }, { 'map.googleMapsLocation': expression },
    ] });
    matchedParentIds = await Property.distinct('_id', propertyFilter);
  }

  const eligiblePropertyIds = await Property.distinct('_id', basePropertyFilter);
  const publicUnitFilter = {
    property: { $in: eligiblePropertyIds }, visibility: 'public', publicationStatus: 'published',
    availabilityStatus: { $ne: 'ARCHIVED' },
  };
  if (req.query.minPrice || req.query.maxPrice) publicUnitFilter['pricing.monthlyRent'] = { ...(req.query.minPrice && { $gte: Number(req.query.minPrice) }), ...(req.query.maxPrice && { $lte: Number(req.query.maxPrice) }) };
  const publicUnitPropertyIds = await RentalUnit.distinct('property', publicUnitFilter);
  // A public rent listing is the parent property. Do not hide it merely
  // because its room inventory is still being migrated or has not yet been
  // published. Apply rent price filters to public rooms only when the visitor
  // explicitly requests a price range.
  if (listingType === 'rent' && (req.query.minPrice || req.query.maxPrice)) propertyFilter._id = { $in: publicUnitPropertyIds };
  const spaceFilter = {
    property: { $in: eligiblePropertyIds },
    visibility: 'public',
    publicationStatus: 'published',
    status: 'available',
    deletedAt: null,
  };
  if (['rent', 'sale', 'lease'].includes(listingType)) spaceFilter.purpose = listingType;
  if (listingType === 'sale') spaceFilter.sellable = true;
  if (listingType === 'rent' || listingType === 'lease') spaceFilter.rentable = true;
  if (listingType === 'rent') spaceFilter.property = { $in: [] };
  if (req.query.level && req.query.level !== 'all') spaceFilter.level = String(req.query.level);
  if (req.query.type && req.query.type !== 'all') spaceFilter.level = String(req.query.type);
  if (req.query.minPrice || req.query.maxPrice) spaceFilter.price = { ...(req.query.minPrice && { $gte: Number(req.query.minPrice) }), ...(req.query.maxPrice && { $lte: Number(req.query.maxPrice) }) };
  if (query) {
    const expression = searchExpression(query);
    spaceFilter.$or = [
      { name: expression }, { code: expression }, { description: expression }, { level: expression }, { amenities: expression },
      ...(matchedParentIds.length ? [{ property: { $in: matchedParentIds } }] : []),
    ];
  }

  const fetchSize = Math.min(page * limit, 500);
  const [properties, spaces, propertyTotal, spaceTotal] = await Promise.all([
    Property.find(propertyFilter).sort({ 'promotion.topListing': -1, 'promotion.featured': -1, isVerified: -1, publishedAt: -1, createdAt: -1 }).limit(fetchSize).populate('owner', 'name avatar kycStatus landlordEnabled').lean(),
    PropertySpace.find(spaceFilter).sort({ 'promotion.topListing': -1, 'promotion.featured': -1, createdAt: -1 }).limit(fetchSize).populate({ path: 'property', populate: { path: 'owner', select: 'name avatar kycStatus landlordEnabled' } }).lean(),
    Property.countDocuments(propertyFilter),
    PropertySpace.countDocuments(spaceFilter),
  ]);
  const visibleProperties = properties;
  const combined = [...visibleProperties.map(serializePublicProperty), ...spaces.filter((item) => item.property).map(serializePublicSpace)]
    .sort((a, b) => Number(Boolean(b.promotion?.topListing || b.isFeatured)) - Number(Boolean(a.promotion?.topListing || a.isFeatured)) || Number(Boolean(b.isVerified)) - Number(Boolean(a.isVerified)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const data = combined.slice((page - 1) * limit, page * limit);
  const total = listingType === 'rent' ? propertyTotal : Math.max(0, propertyTotal - (properties.length - visibleProperties.length)) + spaceTotal;
  res.json({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) });
});

function propertySearchFields(expression) {
  return [
    { title: expression }, { description: expression }, { code: expression }, { referenceNumber: expression },
    { type: expression }, { customType: expression }, { amenities: expression },
    { 'address.line1': expression }, { 'address.line2': expression }, { 'address.locality': expression }, { 'address.landmark': expression }, { 'address.city': expression },
    { 'address.state': expression }, { 'address.country': expression }, { 'address.postalCode': expression },
    { 'map.locality': expression }, { 'map.district': expression }, { 'map.landmark': expression }, { 'map.googleMapsLocation': expression },
  ];
}

function publicSearchResult(type, values) {
  return { type, ...values };
}

export const searchPublicMarketplace = asyncHandler(async (req, res) => {
  setLiveDirectoryHeaders(res);
  const q = String(req.query.q || '').trim();
  if (q.length < 2) throw new ApiError(422, 'Enter at least two characters');
  if (q.length > 120) throw new ApiError(422, 'Search is too long');
  const limit = Math.min(Math.max(Number(req.query.limit || 8), 1), 20);
  const allowedTypes = new Set(['property', 'verified_rental', 'surveyor', 'trusted_seller', 'landlord', 'location']);
  const requestedTypes = compact(String(req.query.types || '').split(',')).filter((type) => allowedTypes.has(type));
  const wants = (type) => !requestedTypes.length || requestedTypes.includes(type) || (type === 'verified_rental' && requestedTypes.includes('property'));
  const expression = searchExpression(q);
  const normalizedQuery = q.toLowerCase();
  const results = [];

  const base = await publicPropertyFilter();
  const baseAnd = [...(base.$and || [])];
  delete base.$and;
  const baseFilter = { ...base, $and: baseAnd };
  const matchingPropertyFilter = { ...base, $and: [...baseAnd, { $or: propertySearchFields(expression) }] };

  if (wants('property') || wants('verified_rental')) {
    const eligiblePropertyIds = await Property.distinct('_id', baseFilter);
    const matchingParentIds = await Property.distinct('_id', matchingPropertyFilter);
    const [properties, spaces] = await Promise.all([
      Property.find(matchingPropertyFilter)
        .sort({ 'promotion.topListing': -1, 'promotion.featured': -1, isVerified: -1, publishedAt: -1, createdAt: -1 })
        .limit(limit)
        .populate('owner', 'name avatar kycStatus landlordEnabled')
        .lean(),
      PropertySpace.find({
        property: { $in: eligiblePropertyIds }, visibility: 'public', publicationStatus: 'published', status: 'available', deletedAt: null,
        $or: [
          { name: expression }, { code: expression }, { description: expression }, { level: expression }, { amenities: expression },
          ...(matchingParentIds.length ? [{ property: { $in: matchingParentIds } }] : []),
        ],
      }).sort({ 'promotion.topListing': -1, 'promotion.featured': -1, createdAt: -1 }).limit(limit)
        .populate({ path: 'property', populate: { path: 'owner', select: 'name avatar kycStatus landlordEnabled' } }).lean(),
    ]);
    const listings = [...properties.map(serializePublicProperty), ...spaces.filter((item) => item.property && item.purpose !== 'rent').map(serializePublicSpace)];
    for (const listing of listings.slice(0, limit)) {
      const verifiedRental = listing.listingType === 'rent' && listing.isVerified;
      const type = verifiedRental ? 'verified_rental' : 'property';
      if (!wants(type) && !(type === 'verified_rental' && wants('property'))) continue;
      const address = compact([listing.address?.locality, listing.address?.city, listing.address?.state, listing.address?.country]).join(', ');
      results.push(publicSearchResult(type, {
        id: String(listing._id),
        title: listing.title,
        subtitle: address || sentenceCase(listing.type),
        description: listing.description || '',
        image: listing.images?.[0] || null,
        badge: verifiedRental ? 'Verified rental' : sentenceCase(listing.listingType || listing.type),
        href: `/marketplace/property_overview/${encodeURIComponent(publicPropertySlug(listing.slug || listing.title))}`,
        verified: Boolean(listing.isVerified),
        featured: Boolean(listing.isFeatured || listing.promotion?.topListing),
        metadata: { price: listing.price, listingType: listing.listingType, city: listing.city, owner: listing.owner?.name || '' },
      }));
    }
  }

  if (wants('surveyor')) {
    const ids = await activePublicSurveyorUserIds();
    const surveyors = await SurveyorProfile.find({
      user: { $in: ids }, visibility: 'public', publicationStatus: 'published', verificationStatus: 'verified',
      $or: [
        { name: expression }, { professionalTitle: expression }, { description: expression }, { specialisations: expression },
        { languages: expression }, { 'serviceLocations.city': expression }, { 'serviceLocations.state': expression },
        { 'officeAddress.line1': expression }, { 'officeAddress.city': expression }, { 'officeAddress.state': expression }, { 'officeAddress.country': expression },
      ],
    }).select(publicProfileProjection()).sort({ isFeatured: -1, isRecommended: -1, 'rating.average': -1 }).limit(limit).lean();
    for (const profile of surveyors) {
      const location = profile.serviceLocations?.[0] || profile.officeAddress || {};
      results.push(publicSearchResult('surveyor', {
        id: String(profile._id), title: profile.name, subtitle: compact([profile.professionalTitle, location.city, location.state]).join(' · '),
        description: profile.description || '', image: profile.profilePhoto || profile.agencyLogo || null, badge: 'Verified surveyor',
        href: `/surveyors/${profile.publicSlug || profile._id}`, verified: true, featured: Boolean(profile.isFeatured),
        metadata: { rating: profile.rating?.average || 0, experience: profile.yearsExperience || 0, specialisations: profile.specialisations || [] },
      }));
    }
  }

  if (wants('trusted_seller') || wants('landlord')) {
    const [ownerIds, locationMatchedOwnerIds] = await Promise.all([
      Property.distinct('owner', baseFilter),
      Property.distinct('owner', matchingPropertyFilter),
    ]);
    const owners = await User.find({
      _id: { $in: ownerIds }, status: 'active', landlordEnabled: true,
      $or: [{ name: expression }, { region: expression }, { _id: { $in: locationMatchedOwnerIds } }],
    }).select('name avatar kycStatus region landlordEnabled').limit(limit).lean();
    for (const owner of owners) {
      const listingFilter = { ...baseFilter, owner: owner._id };
      const [listingCount, saleCount, rentalCount, samples] = await Promise.all([
        Property.countDocuments(listingFilter),
        Property.countDocuments({ ...listingFilter, $and: [...baseAnd, { $or: [{ purpose: 'sale' }, { listingType: 'sale' }] }] }),
        Property.countDocuments({ ...listingFilter, $and: [...baseAnd, { $or: [{ purpose: 'rent' }, { listingType: 'rent' }] }] }),
        Property.find(listingFilter).select('address.city address.state address.country').limit(8).lean(),
      ]);
      const trusted = owner.kycStatus === 'verified' && saleCount > 0;
      const type = trusted ? 'trusted_seller' : 'landlord';
      if (!wants(type)) continue;
      const cities = compact(samples.map((item) => item.address?.city));
      results.push(publicSearchResult(type, {
        id: String(owner._id), title: owner.name,
        subtitle: compact([owner.region, cities.slice(0, 2).join(', ')]).join(' · ') || `${listingCount} public listing${listingCount === 1 ? '' : 's'}`,
        description: trusted ? `${saleCount} sale listing${saleCount === 1 ? '' : 's'} from a KYC-verified seller` : `${rentalCount} rental listing${rentalCount === 1 ? '' : 's'} from an active landlord`,
        image: owner.avatar || null, badge: trusted ? 'Trusted seller' : 'Landlord',
        href: `/marketplace?landlord=${owner._id}${trusted ? '&trustedSeller=true' : ''}`,
        verified: owner.kycStatus === 'verified', featured: false,
        metadata: { listingCount, saleCount, rentalCount, cities },
      }));
    }
  }

  if (wants('location')) {
    const locations = await Property.find(matchingPropertyFilter).select('address map').limit(80).lean();
    const locationMap = new Map();
    const addLocation = (kind, value, parent = '') => {
      const text = String(value || '').trim();
      if (!text || !expression.test(text)) return;
      const key = `${kind}:${text.toLowerCase()}`;
      const existing = locationMap.get(key) || { count: 0, parent };
      existing.count += 1; existing.parent = existing.parent || parent; locationMap.set(key, existing);
    };
    for (const property of locations) {
      const address = property.address || {}; const map = property.map || {};
      addLocation('city', address.city, compact([address.state, address.country]).join(', '));
      addLocation('state', address.state, address.country);
      addLocation('country', address.country);
      addLocation('address', address.line1, compact([address.city, address.state]).join(', '));
      addLocation('address', address.line2, compact([address.city, address.state]).join(', '));
      addLocation('address', map.locality, compact([address.city, address.state]).join(', '));
      addLocation('address', map.district, compact([address.state, address.country]).join(', '));
      addLocation('address', map.landmark, compact([address.city, address.state]).join(', '));
    }
    for (const [key, details] of [...locationMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, limit)) {
      const [kind, ...parts] = key.split(':');
      const value = parts.join(':');
      const label = [...locationMap.keys()].find((candidate) => candidate === key) ? value : value;
      const original = locations.flatMap((property) => {
        const address = property.address || {}; const map = property.map || {};
        return [address.city, address.state, address.country, address.line1, address.line2, address.locality, address.landmark, map.locality, map.district, map.landmark];
      }).find((candidate) => String(candidate || '').trim().toLowerCase() === value) || value;
      const param = kind === 'address' ? 'address' : kind;
      results.push(publicSearchResult('location', {
        id: `${kind}-${value}`, title: original, subtitle: details.parent || sentenceCase(kind), description: `${details.count} matching public listing${details.count === 1 ? '' : 's'}`,
        image: null, badge: sentenceCase(kind), href: `/marketplace?${param}=${encodeURIComponent(original)}`,
        verified: false, featured: false, metadata: { kind, count: details.count },
      }));
    }
  }

  if (wants('verified_rental') && ['verified rental', 'verified rentals', 'rental', 'rent'].some((term) => term.includes(normalizedQuery) || normalizedQuery.includes(term))) {
    results.unshift(publicSearchResult('verified_rental', {
      id: 'verified-rentals-shortcut', title: 'Browse verified rentals', subtitle: 'Only verified properties available for rent', description: '', image: null,
      badge: 'Quick search', href: '/marketplace?listingType=rent&verified=true', verified: true, featured: true, metadata: {},
    }));
  }
  if (wants('trusted_seller') && ['trusted seller', 'trusted sellers', 'seller'].some((term) => term.includes(normalizedQuery) || normalizedQuery.includes(term))) {
    results.unshift(publicSearchResult('trusted_seller', {
      id: 'trusted-sellers-shortcut', title: 'Browse trusted sellers', subtitle: 'KYC-verified property sellers', description: '', image: null,
      badge: 'Quick search', href: '/marketplace?listingType=sale&trustedSeller=true', verified: true, featured: true, metadata: {},
    }));
  }

  const priority = { verified_rental: 0, property: 1, surveyor: 2, trusted_seller: 3, landlord: 4, location: 5 };
  const deduped = [...new Map(results.map((item) => [`${item.type}:${item.id}`, item])).values()]
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(Boolean(b.verified)) - Number(Boolean(a.verified)) || (priority[a.type] ?? 9) - (priority[b.type] ?? 9));
  const counts = deduped.reduce((acc, item) => ({ ...acc, [item.type]: (acc[item.type] || 0) + 1 }), {});
  res.json({ success: true, data: { query: q, results: deduped.slice(0, requestedTypes.length === 1 ? limit : limit * 6), counts } });
});

function sentenceCase(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const streamPublicPropertyMedia = asyncHandler(async (req, res) => {
  const media = await PropertyMedia.findOne({ _id: req.params.id, visibility: 'public', deletedAt: null }).lean();
  if (!media) throw new ApiError(404, 'Public property media not found');
  const property = await Property.findOne(await publicPropertyFilter({ _id: media.property })).select('_id').lean();
  if (!property) throw new ApiError(404, 'Public property media is no longer available');
  const file = await resolvePropertyMediaFile(media, property._id, { publicOnly: true });
  if (!file) throw new ApiError(404, 'Property media file is unavailable');
  await sendStoredFile(req, res, { ...file, name: media.caption || file.name }, { download: false });
});

export const streamPublicRentalUnitImage = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.unitId) || !isObjectId(req.params.fileId)) throw new ApiError(404, 'Public room image not found');
  const unit = await RentalUnit.findOne({
    _id: req.params.unitId,
    visibility: 'public',
    publicationStatus: 'published',
    availabilityStatus: { $ne: 'ARCHIVED' },
  }).select('property landlord primaryImage gallery').lean();
  if (!unit) throw new ApiError(404, 'Public room image not found');

  const property = await Property.findOne(await publicPropertyFilter({ _id: unit.property })).select('_id').lean();
  if (!property) throw new ApiError(404, 'Public room image is no longer available');

  const fileId = String(req.params.fileId);
  const attached = [unit.primaryImage, ...(unit.gallery || [])]
    .some((image) => String(image?.file?._id || image?.file || '') === fileId);
  if (!attached) throw new ApiError(404, 'Public room image not found');

  const file = await DriveFile.findOne({
    _id: fileId,
    owner: unit.landlord,
    status: 'active',
    mimeType: /^image\//i,
  }).select('+storageKey').lean();
  if (!file) throw new ApiError(404, 'Public room image is unavailable');
  const image = [unit.primaryImage, ...(unit.gallery || [])]
    .find((item) => String(item?.file?._id || item?.file || '') === fileId);
  await sendStoredFile(req, res, { ...file, name: image?.name || file.name }, { download: false });
});

export const getPublicProperty = asyncHandler(async (req, res) => {
  const identifier = String(req.params.id || '').trim().toLowerCase();
  const isId = isObjectId(identifier);
  const filter = await publicPropertyFilter(isId ? { _id: identifier } : { slug: identifier });
  let doc = await Property.findOne(filter).populate('owner', 'name avatar kycStatus').lean();
  if (!doc && !isId) {
    const legacyCandidates = await Property.find(await publicPropertyFilter({ slug: { $in: [null, ''] } }))
      .select('_id title')
      .lean();
    const legacy = legacyCandidates.find((candidate) => publicPropertySlug(candidate.title) === identifier);
    if (legacy) doc = await Property.findOne(await publicPropertyFilter({ _id: legacy._id })).populate('owner', 'name avatar kycStatus').lean();
  }
  if (doc) return res.json({ success: true, data: serializePublicProperty(doc) });

  if (!isId) throw new ApiError(404, 'Property listing not found or no longer public');

  const eligiblePropertyIds = await Property.distinct('_id', await publicPropertyFilter());
  const space = await PropertySpace.findOne({
    _id: identifier,
    property: { $in: eligiblePropertyIds },
    visibility: 'public',
    publicationStatus: 'published',
    status: 'available',
    deletedAt: null,
  }).populate({ path: 'property', populate: { path: 'owner', select: 'name avatar kycStatus' } }).lean();
  if (!space?.property) throw new ApiError(404, 'Property listing not found or no longer public');
  res.json({ success: true, data: serializePublicSpace(space) });
});

// Surveyor marketplace
import crypto from 'crypto';
import { SurveyorProfile, SurveyService, SurveyJob } from '../models/index.js';
function publicProfileProjection() {
  return '-privateShare -createdBy -updatedBy';
}
function sanitizeJob(job) {
  const value = { ...job };
  for (const key of ['exactLocation', 'contact', 'documents', 'shortlistedSurveyors', 'invitedSurveyors', 'hiredSurveyor', 'client', 'createdBy', 'updatedBy']) delete value[key];
  if (value.location?.coordinates) value.location = { type: 'Point', coordinates: value.location.coordinates.map((item) => Math.round(Number(item) * 100) / 100) };
  return value;
}

export const listPublicSurveyors = asyncHandler(async (req, res) => {
  setLiveDirectoryHeaders(res);
  const page = Math.max(Number(req.query.page || 1), 1); const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 50);
  const ids = await activeVerifiedPublicSurveyorUserIds();
  const filter = { user: { $in: ids }, visibility: 'public', publicationStatus: 'published', verificationStatus: 'verified' };
  if (req.query.type && req.query.type !== 'all') filter.profileType = req.query.type;
  if (req.query.available === 'true') filter.availability = 'available';
  if (req.query.verified === 'true') filter.verificationStatus = 'verified';
  if (req.query.featured === 'true') filter.isFeatured = true;
  if (req.query.location) filter.$or = [
    { 'serviceLocations.city': new RegExp(String(req.query.location), 'i') },
    { 'serviceLocations.state': new RegExp(String(req.query.location), 'i') },
  ];
  if (req.query.category) filter.specialisations = String(req.query.category);
  if (req.query.minExperience) filter.yearsExperience = { $gte: Number(req.query.minExperience) };
  if (req.query.minRating) filter['rating.average'] = { $gte: Number(req.query.minRating) };
  if (req.query.search) filter.$text = { $search: String(req.query.search) };
  const sortMap = {
    highest_rated: { 'rating.average': -1, 'rating.count': -1 }, most_experienced: { yearsExperience: -1 },
    lowest_price: { startingPrice: 1 }, highest_price: { startingPrice: -1 }, most_completed: { completedProjects: -1 },
    fastest_response: { 'metrics.responseMinutes': 1 }, recently_joined: { createdAt: -1 }, recommended: { isFeatured: -1, isRecommended: -1, 'rating.average': -1 },
  };
  const sort = sortMap[String(req.query.sort || 'recommended')] || sortMap.recommended;
  const [data, total] = await Promise.all([
    SurveyorProfile.find(filter).select(publicProfileProjection()).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    SurveyorProfile.countDocuments(filter),
  ]);
  res.json({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) });
});

export const getPublicSurveyor = asyncHandler(async (req, res) => {
  setLiveDirectoryHeaders(res);
  const ids = await activeVerifiedPublicSurveyorUserIds();
  const query = req.params.id.match(/^[a-f\d]{24}$/i) ? { _id: req.params.id } : { publicSlug: req.params.id };
  const profile = await SurveyorProfile.findOne({ ...query, user: { $in: ids }, visibility: 'public', publicationStatus: 'published', verificationStatus: 'verified' }).select(publicProfileProjection()).lean();
  if (!profile) throw new ApiError(404, 'Surveyor profile not found');
  const services = await SurveyService.find({ surveyor: profile.user, visibility: 'public', status: 'published', 'moderation.status': 'approved' }).select('-createdBy -updatedBy').sort({ isFeatured: -1, createdAt: -1 }).lean();
  await SurveyorProfile.updateOne({ _id: profile._id }, { $inc: { 'metrics.views': 1 } });
  res.json({ success: true, data: { ...profile, services } });
});

export const getPrivateSurveyor = asyncHandler(async (req, res) => {
  const token = String(req.query.token || '');
  if (!token) throw new ApiError(401, 'Private access token required');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const profileRecord = await SurveyorProfile.findOne({ _id: req.params.id, 'privateShare.enabled': true, 'privateShare.tokenHash': tokenHash, 'privateShare.revokedAt': { $exists: false } });
  if (!profileRecord) throw new ApiError(404, 'Private profile link is invalid or revoked');
  if (profileRecord.privateShare?.passwordHash) {
    const code = String(req.query.code || '');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    if (!code || codeHash !== profileRecord.privateShare.passwordHash) throw new ApiError(401, 'Private profile access code required');
  }
  const profile = await SurveyorProfile.findById(profileRecord._id).select(publicProfileProjection()).lean();
  const services = await SurveyService.find({ surveyor: profile.user, visibility: 'private', status: { $nin: ['archived'] } }).select('-createdBy -updatedBy').lean();
  res.json({ success: true, data: { ...profile, services } });
});

export const listPublicSurveyServices = asyncHandler(async (req, res) => {
  setLiveDirectoryHeaders(res);
  const page = Math.max(Number(req.query.page || 1), 1); const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 50);
  const ids = await activePublicSurveyorUserIds();
  const filter = { surveyor: { $in: ids }, visibility: 'public', status: 'published', 'moderation.status': 'approved' };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.subtype) filter.subtype = req.query.subtype;
  if (req.query.minPrice || req.query.maxPrice) filter.startingPrice = { ...(req.query.minPrice && { $gte: Number(req.query.minPrice) }), ...(req.query.maxPrice && { $lte: Number(req.query.maxPrice) }) };
  if (req.query.location) filter.$or = [{ 'coverageAreas.city': new RegExp(String(req.query.location), 'i') }, { 'coverageAreas.state': new RegExp(String(req.query.location), 'i') }];
  if (req.query.emergency === 'true') filter.emergencyAvailable = true;
  if (req.query.online === 'true') filter.onlineConsultation = true;
  if (req.query.search) filter.$text = { $search: String(req.query.search) };
  const sort = req.query.sort === 'lowest_price' ? { startingPrice: 1 } : req.query.sort === 'highest_price' ? { startingPrice: -1 } : { isFeatured: -1, createdAt: -1 };
  const [data, total] = await Promise.all([
    SurveyService.find(filter).populate('profile', 'name profilePhoto agencyLogo verificationStatus rating publicSlug availability').sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    SurveyService.countDocuments(filter),
  ]);
  res.json({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) });
});

export const listPublicSurveyJobs = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1); const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);
  const filter = { visibility: 'public', status: 'open', $or: [{ closesAt: null }, { closesAt: { $gt: new Date() } }, { closesAt: { $exists: false } }] };
  if (req.query.category) filter.surveyType = req.query.category;
  if (req.query.location) filter.addressApproximate = new RegExp(String(req.query.location), 'i');
  if (req.query.urgency) filter.urgency = req.query.urgency;
  if (req.query.minBudget || req.query.maxBudget) filter['budget.max'] = { ...(req.query.minBudget && { $gte: Number(req.query.minBudget) }), ...(req.query.maxBudget && { $lte: Number(req.query.maxBudget) }) };
  if (req.query.search) filter.$text = { $search: String(req.query.search) };
  const [jobs, total] = await Promise.all([SurveyJob.find(filter).sort({ urgency: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), SurveyJob.countDocuments(filter)]);
  res.json({ success: true, data: jobs.map(sanitizeJob), total, page, limit, totalPages: Math.ceil(total / limit) });
});
