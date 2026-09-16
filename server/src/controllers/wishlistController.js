import { Property, PropertySpace, Wishlist } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { publicPropertyFilter } from './publicController.js';
import { serializePublicProperty, serializePublicSpace } from '../services/publicPropertySerialization.js';

const MAX_WISHLIST_ITEMS = 100;
const LISTING_KINDS = new Set(['property', 'space']);

function validObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ''));
}

function normalizeKind(value) {
  return LISTING_KINDS.has(String(value || '').trim().toLowerCase()) ? String(value).trim().toLowerCase() : 'property';
}

async function resolvePublicListing(listingId, listingKind) {
  if (!validObjectId(listingId)) throw new ApiError(422, 'Wishlist listing id is invalid');
  const kind = normalizeKind(listingKind);
  const base = await publicPropertyFilter();

  if (kind === 'space') {
    const space = await PropertySpace.findOne({ _id: listingId, visibility: 'public', publicationStatus: 'published', status: 'available', deletedAt: null }).lean();
    if (!space) throw new ApiError(404, 'This public listing is no longer available');
    const parent = await Property.findOne({ ...base, _id: space.property }).populate('owner', 'name avatar kycStatus landlordEnabled').lean();
    if (!parent) throw new ApiError(404, 'This public listing is no longer available');
    return { listingId: String(space._id), listingKind: kind, listing: serializePublicSpace({ ...space, property: parent }) };
  }

  const property = await Property.findOne({ ...base, _id: listingId }).populate('owner', 'name avatar kycStatus landlordEnabled').lean();
  if (!property) throw new ApiError(404, 'This public listing is no longer available');
  return { listingId: String(property._id), listingKind: kind, listing: serializePublicProperty(property) };
}

async function wishlistEntries(userId) {
  const rows = await Wishlist.find({ user: userId }).sort({ createdAt: -1 }).limit(MAX_WISHLIST_ITEMS).lean();
  const resolved = await Promise.all(rows.map(async (row) => {
    try {
      const value = await resolvePublicListing(row.listingId, row.listingKind);
      return { _id: String(row._id), listingId: value.listingId, listingKind: value.listingKind, addedAt: row.createdAt, listing: value.listing };
    } catch (error) {
      if (error?.statusCode === 404) await Wishlist.deleteOne({ _id: row._id });
      return null;
    }
  }));
  return resolved.filter(Boolean);
}

export const listWishlist = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await wishlistEntries(req.user._id) });
});

export const addWishlist = asyncHandler(async (req, res) => {
  const listingId = String(req.body?.listingId || '').trim();
  const listingKind = normalizeKind(req.body?.listingKind);
  const value = await resolvePublicListing(listingId, listingKind);
  const existing = await Wishlist.findOne({ user: req.user._id, listingId: value.listingId, listingKind: value.listingKind }).lean();
  if (!existing) {
    const count = await Wishlist.countDocuments({ user: req.user._id });
    if (count >= MAX_WISHLIST_ITEMS) throw new ApiError(422, `Wishlist is limited to ${MAX_WISHLIST_ITEMS} listings`);
  }
  const row = await Wishlist.findOneAndUpdate(
    { user: req.user._id, listingId: value.listingId, listingKind: value.listingKind },
    { $setOnInsert: { user: req.user._id, listingId: value.listingId, listingKind: value.listingKind } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  res.status(201).json({ success: true, data: { _id: String(row._id), listingId: value.listingId, listingKind: value.listingKind, addedAt: row.createdAt, listing: value.listing }, message: 'Added to wishlist' });
});

export const removeWishlist = asyncHandler(async (req, res) => {
  const listingId = String(req.params.listingId || '').trim();
  if (!validObjectId(listingId)) throw new ApiError(422, 'Wishlist listing id is invalid');
  const listingKind = normalizeKind(req.query?.listingKind || req.body?.listingKind);
  await Wishlist.deleteOne({ user: req.user._id, listingId, listingKind });
  res.json({ success: true, data: { listingId, listingKind }, message: 'Removed from wishlist' });
});

export const syncWishlist = asyncHandler(async (req, res) => {
  const source = Array.isArray(req.body?.items) ? req.body.items.slice(0, MAX_WISHLIST_ITEMS) : [];
  const values = [];
  for (const item of source) {
    try { values.push(await resolvePublicListing(String(item?.listingId || ''), item?.listingKind)); } catch { /* stale guest entries are ignored */ }
  }
  if (values.length) {
    await Wishlist.bulkWrite(values.map((value) => ({
      updateOne: {
        filter: { user: req.user._id, listingId: value.listingId, listingKind: value.listingKind },
        update: { $setOnInsert: { user: req.user._id, listingId: value.listingId, listingKind: value.listingKind } },
        upsert: true,
      },
    })), { ordered: false });
  }
  res.json({ success: true, data: await wishlistEntries(req.user._id), message: 'Wishlist synchronised' });
});
