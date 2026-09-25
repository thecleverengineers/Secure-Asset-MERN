import {
  SiteSetting, SeoPage, HomeCarousel, HomeSection, LandlordPlan, PropertyTypeConfig, AreaUnit, SiteEnquiry,
  Property, PropertySpace, PropertyMedia, RentalUnit, Subscription, SurveyorProfile,
} from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ensureLandlordPlans } from '../services/landlordSubscription.js';
import { publicPropertySlug, serializePublicProperty, serializePublicRentalUnit, serializePublicSpace, serializePublicMedia } from '../services/publicPropertySerialization.js';
import { ensurePlatformConfiguration, getApplicationAccessSummary, getContentPage, getPublicNavigation } from '../services/platformConfiguration.js';
import { emitRealtime } from '../services/realtime.js';
import { DEFAULT_DESIGN_SYSTEM, DEFAULT_SITE_FOOTER } from '../services/platformDefaults.js';
import { getMapsConfiguration } from '../services/maps.js';
import { activePublicSurveyorUserIds } from '../services/publicSurveyorEligibility.js';

const AUTHENTICATION_DEFAULTS = {
  badge: 'Enterprise property operations', headline: 'Every property workflow. One secure platform.',
  description: 'Manage properties, tenants, payments, surveys, legal records and communication with secure role-based access.',
  features: ['Role-based access', 'Encrypted document vault', 'Real-time messaging', 'Automated billing', 'Audit trails'],
  footerText: 'Enterprise property, tenancy and survey operations', loginTitle: 'Welcome back', loginSubtitle: 'Sign in with your organisation account.',
  registerTitle: 'Create your account', registerSubtitle: 'Create your account and verify your registered mobile number with a secure OTP.',
  otpTitle: 'Passwordless login', otpSubtitle: 'Use a secure one-time password sent to your registered mobile.',
  forgotTitle: 'Reset password', forgotSubtitle: 'Enter your registered email or mobile number. The reset OTP is sent to your registered mobile.',
  allowRegistration: true, allowPasswordLogin: true, allowOtpLogin: true, showDemoAccounts: false,
};
const OPEN_SANS_FONT_NAME = 'Open Sans';
const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

const footerLinks = (links, fallback) => {
  const valid = Array.isArray(links)
    ? links.map((link) => ({ label: String(link?.label || '').trim(), path: String(link?.path || '').trim(), external: Boolean(link?.external) })).filter((link) => link.label && link.path)
    : [];
  return valid.length ? valid : fallback;
};

const withFooterDefaults = (footer = {}) => {
  const navigation = Array.isArray(footer?.navigation)
    ? footer.navigation.map((group) => ({ heading: String(group?.heading || '').trim(), links: footerLinks(group?.links, []) })).filter((group) => group.heading && group.links.length)
    : [];
  return {
    ...DEFAULT_SITE_FOOTER,
    ...(footer || {}),
    navigation: navigation.length ? navigation : DEFAULT_SITE_FOOTER.navigation,
    legalLinks: footerLinks(footer?.legalLinks, DEFAULT_SITE_FOOTER.legalLinks),
    callback: { ...DEFAULT_SITE_FOOTER.callback, ...(footer?.callback || {}) },
  };
};

const withDesignDefaults = (design = {}) => {
  const iconAssetMap = (value) => value && typeof value.toObject === 'function'
    ? value.toObject()
    : value instanceof Map
      ? Object.fromEntries(value.entries())
      : (value && typeof value === 'object' ? value : {});
  const layers = Array.isArray(design?.canvas?.layers)
    ? design.canvas.layers.slice(0, 1600).map((layer) => ({ ...layer, style: { ...(layer?.style || {}), fontFamily: OPEN_SANS_FONT_NAME } }))
    : [];
  return {
    ...DEFAULT_DESIGN_SYSTEM,
    ...(design || {}),
    colors: { ...DEFAULT_DESIGN_SYSTEM.colors, ...(design?.colors || {}) },
    typography: { ...DEFAULT_DESIGN_SYSTEM.typography, ...(design?.typography || {}), fontFamily: OPEN_SANS_FONT_NAME },
    layout: { ...DEFAULT_DESIGN_SYSTEM.layout, ...(design?.layout || {}) },
    borders: { ...DEFAULT_DESIGN_SYSTEM.borders, ...(design?.borders || {}) },
    shadows: { ...DEFAULT_DESIGN_SYSTEM.shadows, ...(design?.shadows || {}) },
    icons: { ...DEFAULT_DESIGN_SYSTEM.icons, ...(design?.icons || {}) },
    effects: { ...DEFAULT_DESIGN_SYSTEM.effects, ...(design?.effects || {}) },
    branding: { ...DEFAULT_DESIGN_SYSTEM.branding, ...(design?.branding || {}), fontFamily: OPEN_SANS_FONT_NAME },
    buttons: Object.fromEntries(Object.entries(DEFAULT_DESIGN_SYSTEM.buttons).map(([key, fallback]) => [key, { ...fallback, ...(design?.buttons?.[key] || {}) }])),
    bottomAppBar: { ...DEFAULT_DESIGN_SYSTEM.bottomAppBar, ...(design?.bottomAppBar || {}) },
    iconLibrary: { ...DEFAULT_DESIGN_SYSTEM.iconLibrary, ...(design?.iconLibrary || {}) },
    iconAssets: { ...DEFAULT_DESIGN_SYSTEM.iconAssets, ...(design?.iconAssets || {}), bottomAppBar: { ...DEFAULT_DESIGN_SYSTEM.iconAssets.bottomAppBar, ...iconAssetMap(design?.iconAssets?.bottomAppBar) }, quickAccess: { ...DEFAULT_DESIGN_SYSTEM.iconAssets.quickAccess, ...iconAssetMap(design?.iconAssets?.quickAccess) } },
    navigation: Array.isArray(design?.navigation) ? design.navigation.slice(0, 120) : [],
    pageDesigns: Array.isArray(design?.pageDesigns) ? design.pageDesigns.slice(0, 400) : [],
    componentLibrary: { ...DEFAULT_DESIGN_SYSTEM.componentLibrary, ...(design?.componentLibrary || {}) },
    profiles: { ...DEFAULT_DESIGN_SYSTEM.profiles, ...(design?.profiles || {}) },
    motion: { ...DEFAULT_DESIGN_SYSTEM.motion, ...(design?.motion || {}) },
    canvas: { ...DEFAULT_DESIGN_SYSTEM.canvas, ...(design?.canvas || {}), layers },
  };
};

async function ensureSiteSetting() {
  let setting = await SiteSetting.findOne({ key: 'default' }).lean();
  if (!setting) {
    setting = (await SiteSetting.create({
      key: 'default', siteTitle: 'SecureAsset', shortTitle: 'SecureAsset',
      tagline: 'Property, tenancy and survey management in one secure platform.',
      description: 'Manage properties, tenants, surveys, legal records and payments from one secure platform.',
      contact: { email: 'hello@secureasset.in', phone: '', address: 'India' },
      seo: { defaultTitle: 'SecureAsset — Property, Tenant and Survey Management', defaultDescription: 'Discover properties and manage the complete rental, tenancy and survey lifecycle.', titleTemplate: '%s | SecureAsset', robots: 'index,follow' },
      footer: DEFAULT_SITE_FOOTER,
      design: DEFAULT_DESIGN_SYSTEM,
    })).toObject();
  }
  return { ...setting, brand: { ...(setting.brand || {}), fontFamily: OPEN_SANS_FONT_NAME }, authentication: { ...AUTHENTICATION_DEFAULTS, ...(setting.authentication || {}) }, footer: withFooterDefaults(setting.footer), design: withDesignDefaults(setting.design) };
}

async function featuredMarketplaceData(sections) {
  const wantsProperties = sections.some((item) => item.type === 'featured_properties');
  const wantsSurveyors = sections.some((item) => item.type === 'featured_surveyors');
  const [featuredProperties, featuredSurveyors] = await Promise.all([
    wantsProperties ? (async () => {
      const activeOwners = await Subscription.distinct('user', { status: 'active', expiresAt: { $gt: new Date() } });
      const records = await Property.find({
        visibility: 'public', publicationStatus: 'published', status: { $in: ['available', 'partially_occupied', 'occupied', 'reserved', 'rented'] }, deletedAt: null,
        $and: [
          { $or: [{ requiresActiveSubscription: false }, { owner: { $in: activeOwners } }] },
          { $or: [{ isFeatured: true }, { 'promotion.featured': true }, { 'promotion.topListing': true }] },
        ],
      }).sort({ 'promotion.topListing': -1, 'promotion.featured': -1, publishedAt: -1 }).limit(12).populate('owner', 'name avatar kycStatus').lean();
      return records.map(serializePublicProperty);
    })() : [],
    wantsSurveyors ? (async () => {
      const activeSurveyors = await activePublicSurveyorUserIds();
      return SurveyorProfile.find({ user: { $in: activeSurveyors }, visibility: 'public', publicationStatus: 'published', verificationStatus: 'verified' })
        .select('-privateShare -createdBy -updatedBy').sort({ isFeatured: -1, 'rating.average': -1, completedProjects: -1 }).limit(12).lean();
    })() : [],
  ]);
  return { featuredProperties, featuredSurveyors };
}

export const getPublicSite = asyncHandler(async (req, res) => {
  await Promise.all([ensureLandlordPlans(), ensurePlatformConfiguration()]);
  const now = new Date();
  const path = String(req.query.path || '/').split('?')[0] || '/';
  const [settings, maps, seo, carousel, sections, landlordPlans, propertyTypes, areaUnits, publicNavigation, page, footerPages] = await Promise.all([
    ensureSiteSetting(),
    getMapsConfiguration(),
    SeoPage.findOne({ path, active: true }).lean(),
    HomeCarousel.find({ active: true, $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }, { startsAt: { $exists: false } }] }, { $or: [{ endsAt: null }, { endsAt: { $gt: now } }, { endsAt: { $exists: false } }] }] }).sort({ sortOrder: 1, createdAt: 1 }).lean(),
    HomeSection.find({ active: true }).sort({ sortOrder: 1 }).lean(),
    LandlordPlan.find({ active: true }).sort({ rank: 1 }).lean(),
    PropertyTypeConfig.find({ active: true }).sort({ sortOrder: 1, label: 1 }).lean(),
    AreaUnit.find({ active: true }).sort({ sortOrder: 1, label: 1 }).lean(),
    getPublicNavigation(),
    getContentPage(path, false),
    ContentPage.find({ active: true, visibility: 'public', 'footer.enabled': true })
      .select('path title footer')
      .sort({ 'footer.sortOrder': 1, title: 1 })
      .lean(),
  ]);
  const featured = await featuredMarketplaceData(sections);
  const publicMapKeys = [
    'provider', 'publicApiKey', 'enabled', 'navigationEnabled', 'locationPickerEnabled', 'reverseGeocodeEnabled', 'directionsEnabled',
    'serverRoutesEnabled', 'routesEnabled', 'placesEnabled', 'placesUiKitEnabled', 'addressValidationEnabled', 'elevationEnabled', 'roadsEnabled',
    'routeOptimizationEnabled', 'navigationConnectEnabled', 'groundingLiteEnabled', 'streetViewPublishEnabled', 'useTraffic',
    'routeRefreshSeconds', 'locationUpdateSeconds', 'maxRouteWaypoints', 'cloudProjectId', 'regionCode', 'languageCode', 'units',
    'navigationConnectAndroidAppId', 'navigationConnectIosAppId', 'mapId', 'defaultLatitude', 'defaultLongitude', 'defaultZoom', 'travelMode',
  ];
  const safeMap = { ...(settings.map || {}) };
  for (const key of publicMapKeys) if (maps[key] !== undefined) safeMap[key] = maps[key];
  const safeSettings = { ...settings, map: safeMap };
  if (safeSettings.map) delete safeSettings.map.privateApiKey;
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  res.json({ success: true, data: { settings: safeSettings, seo, page, carousel, sections, landlordPlans, propertyTypes, areaUnits, publicNavigation, footerPages, ...featured } });
});

export const getAppConfiguration = asyncHandler(async (req, res) => {
  const [access, settings] = await Promise.all([getApplicationAccessSummary(req.user), ensureSiteSetting()]);
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data: { modules: access.modules, permissions: access.permissions, resourcePermissions: access.resourcePermissions, effectiveRole: access.effectiveRole, effectiveMode: access.effectiveMode, subscription: access.subscription, mode: req.user.activeMode || 'regular', role: req.user.role, siteTitle: settings.siteTitle, shortTitle: settings.shortTitle } });
});

export const submitSiteEnquiry = asyncHandler(async (req, res) => {
  const requestedType = String(req.body.type || 'contact').trim().toLowerCase();
  const allowedTypes = new Set(['contact', 'property', 'support', 'callback']);
  const type = req.body.property ? 'property' : (allowedTypes.has(requestedType) ? requestedType : 'contact');
  const preferredCallbackAt = req.body.preferredCallbackAt ? new Date(req.body.preferredCallbackAt) : undefined;
  if (preferredCallbackAt && Number.isNaN(preferredCallbackAt.getTime())) throw new ApiError(422, 'Choose a valid preferred callback time');
  const body = {
    name: String(req.body.name || '').trim(), email: String(req.body.email || '').trim().toLowerCase(), phone: String(req.body.phone || '').trim(),
    message: String(req.body.message || '').trim(), property: req.body.property || undefined, space: req.body.space || undefined,
    type, preferredCallbackAt, callbackWindow: String(req.body.callbackWindow || '').trim() || undefined, status: 'new',
  };
  if (body.type === 'callback' && !body.message) body.message = 'Callback requested from the public callback page.';
  if (!body.name || (!body.email && !body.phone) || (body.type !== 'callback' && !body.message)) throw new ApiError(422, 'Name, message and email or phone are required');
  if (body.type === 'callback' && !body.phone) throw new ApiError(422, 'A phone number is required for a callback request');
  const data = await SiteEnquiry.create(body);
  emitRealtime('site-enquiries', 'created', data, { roles: ['admin', 'manager'] });
  res.status(201).json({ success: true, data: { _id: data._id }, message: body.type === 'callback' ? 'Your callback request has been submitted' : 'Your enquiry has been submitted' });
});

export const getPublicPropertyStructure = asyncHandler(async (req, res) => {
  const identifier = String(req.params.id || '').trim().toLowerCase();
  const isId = isObjectId(identifier);
  const activeOwnerIds = await Subscription.distinct('user', { status: 'active', expiresAt: { $gt: new Date() } });
  const eligibility = {
    visibility: 'public', publicationStatus: 'published', status: { $in: ['available', 'partially_occupied', 'occupied', 'reserved', 'rented'] }, deletedAt: null,
    $or: [{ requiresActiveSubscription: false }, { owner: { $in: activeOwnerIds } }],
  };

  let selectedSpaceRecord = null;
  let selectedRentalUnitRecord = null;
  let property = await Property.findOne({ ...(isId ? { _id: identifier } : { slug: identifier }), ...eligibility }).populate('owner', 'name avatar kycStatus').lean();
  if (!property && !isId) {
    const legacyCandidates = await Property.find({ ...eligibility, slug: { $in: [null, ''] } }).select('_id title').lean();
    const legacy = legacyCandidates.find((candidate) => publicPropertySlug(candidate.title) === identifier);
    if (legacy) property = await Property.findOne({ _id: legacy._id, ...eligibility }).populate('owner', 'name avatar kycStatus').lean();
  }
  if (!property && isId) {
    selectedSpaceRecord = await PropertySpace.findOne({ _id: identifier, visibility: 'public', publicationStatus: 'published', status: 'available', deletedAt: null }).lean();
    if (selectedSpaceRecord) property = await Property.findOne({ _id: selectedSpaceRecord.property, ...eligibility }).populate('owner', 'name avatar kycStatus').lean();
  }
  if (!property && isId) {
    selectedRentalUnitRecord = await RentalUnit.findOne({ _id: identifier, visibility: 'public', publicationStatus: 'published', availabilityStatus: { $ne: 'ARCHIVED' } }).lean();
    if (selectedRentalUnitRecord) property = await Property.findOne({ _id: selectedRentalUnitRecord.property, ...eligibility }).populate('owner', 'name avatar kycStatus').lean();
  }
  if (!property) throw new ApiError(404, 'Property not found');

  const [spaces, media, rentalUnits] = await Promise.all([
    PropertySpace.find({ property: property._id, visibility: 'public', publicationStatus: 'published', status: { $in: ['available', 'reserved'] }, deletedAt: null }).sort({ sortOrder: 1, createdAt: 1 }).lean(),
    PropertyMedia.find({ property: property._id, visibility: 'public', deletedAt: null }).sort({ cover: -1, sortOrder: 1, createdAt: 1 }).lean(),
    RentalUnit.find({ property: property._id, visibility: 'public', publicationStatus: 'published', availabilityStatus: { $ne: 'ARCHIVED' } })
      .populate('floor', 'floorName floorNumber floorCode').sort({ roomNumberKey: 1 }).lean(),
  ]);
  // Keep the public parent visible while a landlord is adding or publishing
  // room inventory. Room-level booking remains available only for published
  // RentalUnit records returned below.
  const publicProperty = serializePublicProperty(property);
  const publicSpaces = spaces.map((space) => {
    const serialized = serializePublicSpace({ ...space, property });
    delete serialized.property;
    return { ...serialized, children: [], media: [] };
  });
  const nodes = new Map(publicSpaces.map((space) => [String(space._id), space]));
  const roots = [];
  nodes.forEach((node) => {
    const parentId = node.parent ? String(node.parent) : null;
    if (parentId && nodes.has(parentId)) nodes.get(parentId).children.push(node); else roots.push(node);
  });
  media.map(serializePublicMedia).forEach((item) => {
    if (item.space && nodes.has(String(item.space))) nodes.get(String(item.space)).media.push(item);
  });
  const propertyMedia = media.filter((item) => !item.space).map(serializePublicMedia);
  const selectedSpace = selectedSpaceRecord ? serializePublicSpace({ ...selectedSpaceRecord, property }) : null;
  const publicRentalUnits = rentalUnits.map(serializePublicRentalUnit);
  const selectedRentalUnit = selectedRentalUnitRecord
    ? publicRentalUnits.find((item) => String(item._id) === String(selectedRentalUnitRecord._id)) || serializePublicRentalUnit(selectedRentalUnitRecord)
    : null;

  await Property.updateOne({ _id: property._id }, { $inc: { 'metrics.views': 1 } });
  if (selectedSpaceRecord) await PropertySpace.updateOne({ _id: selectedSpaceRecord._id }, { $inc: { 'metrics.views': 1 } });
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  res.json({ success: true, data: { property: publicProperty, selectedSpace, selectedRentalUnit, spaces: roots, media: propertyMedia, rentalUnits: publicRentalUnits, rentalStructureMode: property.floorManagementEnabled ? 'floor' : 'flat' } });
});
