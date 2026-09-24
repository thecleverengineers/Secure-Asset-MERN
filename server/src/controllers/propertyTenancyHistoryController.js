import mongoose from 'mongoose';
import { z } from 'zod';
import { Property, PropertyMedia, RentalUnit, Tenancy } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { capabilityRolesForUser } from '../services/rbac.js';
import { historyId, historyCounts, propertyHistoryRent, tenancyHistoryRow } from '../services/propertyTenancyHistory.js';

const propertyFields = '_id title code address images galleryCover pricing purpose listingType status deletedAt createdAt';
const summaryFields = 'property status startDate closedAt monthlyRent';
const historyFields = 'tenancyNumber tenant property space rentalUnit status startDate endDate monthlyRent closedAt createdAt statusHistory notices moveInInspection.completedAt moveOutInspection.completedAt moveOutSettlement.settledAt';
const paramsSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().trim().max(160).default(''),
  filter: z.enum(['all', 'current', 'past', 'upcoming', 'cancelled', 'other']).default('all'),
});
function input(req) {
  if (!capabilityRolesForUser(req.user).includes('landlord')) throw new ApiError(403, 'Landlord access required');
  const parsed = paramsSchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, 'Invalid tenancy history filters');
  return parsed.data;
}
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function mediaForProperties(properties) {
  if (!properties.length) return properties;
  const media = await PropertyMedia.find({ property: { $in: properties.map((property) => property._id) }, mediaType: 'image' })
    .select('property url thumbnailUrl driveFile document cover sortOrder').sort({ cover: -1, sortOrder: 1, createdAt: 1 }).lean();
  const covers = new Map();
  for (const item of media) if (!covers.has(historyId(item.property))) covers.set(historyId(item.property), item);
  return properties.map((property) => ({ ...property, propertyMedia: covers.has(historyId(property)) ? [covers.get(historyId(property))] : [] }));
}

export const listTenancyHistoryProperties = asyncHandler(async (req, res) => {
  const { page, limit, search } = input(req);
  // Ownership is mandatory even for archived listings. History remains readable
  // when a landlord archives a property, without exposing another owner's data.
  const filter = { owner: req.user._id };
  if (search) filter.$or = ['title', 'code', 'address.city', 'address.locality'].map((field) => ({ [field]: new RegExp(escapeRegex(search), 'i') }));
  const total = await Property.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, pages);
  const properties = await Property.find(filter).select(propertyFields).sort({ createdAt: -1, _id: -1 }).skip((currentPage - 1) * limit).limit(limit).lean();
  const ids = properties.map((property) => property._id);
  const [tenancies, units, withMedia] = await Promise.all([
    Tenancy.find({ landlord: req.user._id, property: { $in: ids } }).select(summaryFields).lean(),
    RentalUnit.find({ landlord: req.user._id, property: { $in: ids }, archivedAt: null }).select('property pricing publicationStatus archivedAt').lean(),
    mediaForProperties(properties),
  ]);
  const now = new Date();
  const data = withMedia.map((property) => {
    const history = tenancies.filter((record) => historyId(record.property) === historyId(property));
    return { ...property, counts: historyCounts(history, now), rent: propertyHistoryRent(property, history, units.filter((unit) => historyId(unit.property) === historyId(property)), now) };
  });
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data, pagination: { total, page: currentPage, pages, limit } });
});

export const getPropertyTenancyHistory = asyncHandler(async (req, res) => {
  const { page, limit, search, filter } = input(req);
  if (!mongoose.isValidObjectId(req.params.propertyId)) throw new ApiError(404, 'Property not found');
  const property = await Property.findOne({ _id: req.params.propertyId, owner: req.user._id }).select(propertyFields).lean();
  if (!property) throw new ApiError(404, 'Property not found');
  const [records, units, withMedia] = await Promise.all([
    Tenancy.find({ landlord: req.user._id, property: property._id }).select(historyFields)
      .populate('tenant', 'name avatar email phone')
      .populate({ path: 'rentalUnit', select: 'name roomNumber floor', populate: { path: 'floor', select: 'name' } })
      .populate('space', 'name unitNumber').sort({ startDate: -1, createdAt: -1, _id: -1 }).lean(),
    RentalUnit.find({ landlord: req.user._id, property: property._id, archivedAt: null }).select('pricing publicationStatus archivedAt').lean(),
    mediaForProperties([property]),
  ]);
  const now = new Date();
  const needle = search.toLowerCase();
  const rows = records.map((record) => tenancyHistoryRow(record, now)).filter((row) => (filter === 'all' || row.group === filter)
    && (!needle || [row.tenant?.name, row.tenancyNumber, row.unitName, row.roomNumber, row.floorName].some((value) => String(value || '').toLowerCase().includes(needle))));
  const pages = Math.max(1, Math.ceil(rows.length / limit));
  const currentPage = Math.min(page, pages);
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data: {
    property: withMedia[0], rent: propertyHistoryRent(property, records, units, now), counts: historyCounts(records, now),
    records: rows.slice((currentPage - 1) * limit, currentPage * limit),
    pagination: { total: rows.length, page: currentPage, pages, limit },
  } });
});
