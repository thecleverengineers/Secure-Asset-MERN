import mongoose from 'mongoose';
import {
  AgreementRequest,
  Application,
  Payment,
  Property,
  PropertyFloor,
  RentCycle,
  RentalInvoice,
  RentalUnit,
  Tenancy,
  DriveFile,
} from '../models/index.js';
import { writeAudit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { createNotification } from '../services/notifications.js';
import { assertLandlordLimit } from '../services/landlordSubscription.js';
import { sendStoredFile } from '../utils/httpFile.js';
import {
  propertyManagedBy,
  releaseRentalUnitAfterClosedTenancy,
  syncPropertyRentalSummary,
  transitionRentalUnit,
  transitionRentalUnitToPaymentPending,
} from '../services/rentalUnitLifecycle.js';

const UNIT_STATUSES = new Set(['AVAILABLE', 'RESERVED', 'APPLICATION_PENDING', 'AGREEMENT_PENDING', 'PAYMENT_PENDING', 'OCCUPIED', 'NOTICE_PERIOD', 'VACATING', 'MAINTENANCE', 'BLOCKED', 'ARCHIVED']);
const IMAGE_CATEGORIES = new Set(['bedroom', 'bathroom', 'toilet', 'kitchen', 'balcony', 'living_room', 'furniture', 'other']);
const SPECIFICATION_FIELDS = [
  'roomCategory', 'roomType', 'bhkConfiguration', 'bedroomCount', 'bathroomCount', 'bathroomAccess',
  'toiletCount', 'toiletAccess', 'kitchenAvailable', 'kitchenAccess', 'drawingRoom', 'livingRoom', 'diningHall', 'balcony',
  'furnishingStatus', 'airConditioning', 'liftAccess', 'roomSize', 'carpetArea', 'maximumOccupants',
  'preferredOccupancy', 'orientation', 'electricityArrangement', 'waterArrangement', 'internetWifi',
  'parkingEligibility', 'otherAmenities',
];
const PRICING_FIELDS = [
  'currency', 'monthlyRent', 'securityDeposit', 'maintenanceCharge', 'maintenanceFrequency', 'electricity',
  'electricityFixedAmount', 'water', 'waterFixedAmount', 'bookingAmount', 'minimumStayMonths',
  'availableFrom', 'additionalCharges',
];

function sameId(left, right) {
  return Boolean(left && right && String(left?._id || left) === String(right?._id || right));
}

function pick(source, keys) {
  return Object.fromEntries(keys.filter((key) => Object.prototype.hasOwnProperty.call(source || {}, key)).map((key) => [key, source[key]]));
}

function requiredText(value, label, maxLength = 180) {
  const text = String(value || '').trim();
  if (!text) throw new ApiError(422, `${label} is required`);
  if (text.length > maxLength) throw new ApiError(422, `${label} must be ${maxLength} characters or fewer`);
  return text;
}

function optionalText(value, maxLength = 1000) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeGallery(items = []) {
  if (!Array.isArray(items)) throw new ApiError(422, 'Room gallery must be a list');
  return items.slice(0, 80).map((item, index) => ({
    ...(mongoose.isValidObjectId(item?.file?._id || item?.file) && { file: item.file?._id || item.file }),
    url: optionalText(item?.url, 2048),
    name: requiredText(item?.name || item?.caption || `Room image ${index + 1}`, 'Image name'),
    category: IMAGE_CATEGORIES.has(String(item?.category || '')) ? String(item.category) : 'other',
    caption: optionalText(item?.caption, 300),
    description: optionalText(item?.description, 1500),
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Math.max(0, Number(item.sortOrder)) : index,
  }));
}

function normalizePrimaryImage(item) {
  if (!item) return undefined;
  return normalizeGallery([{ ...item, name: item.name || item.caption || 'Primary room image' }])[0];
}

function normalizePricing(value = {}) {
  const pricing = pick(value, PRICING_FIELDS);
  for (const key of ['monthlyRent', 'securityDeposit', 'maintenanceCharge', 'electricityFixedAmount', 'waterFixedAmount', 'bookingAmount']) {
    if (pricing[key] !== undefined) {
      const amount = Number(pricing[key]);
      if (!Number.isFinite(amount) || amount < 0) throw new ApiError(422, `${key} must be a non-negative amount`);
      pricing[key] = amount;
    }
  }
  if (pricing.minimumStayMonths !== undefined) {
    const months = Number(pricing.minimumStayMonths);
    if (!Number.isInteger(months) || months < 0 || months > 120) throw new ApiError(422, 'Minimum stay must be between 0 and 120 months');
    pricing.minimumStayMonths = months;
  }
  return pricing;
}

function validatePublishedPricing({ visibility, publicationStatus, pricing }) {
  if (visibility === 'public' && publicationStatus === 'published' && Number(pricing?.monthlyRent || 0) <= 0) {
    throw new ApiError(422, 'Set the room monthly rent before publishing this rental unit');
  }
}

async function floorForProperty(property, floorId) {
  if (!property.floorManagementEnabled) return null;
  if (!floorId) return null;
  if (!mongoose.isValidObjectId(floorId)) throw new ApiError(422, 'Choose a floor for this room');
  const floor = await PropertyFloor.findOne({ _id: floorId, property: property._id, status: 'active' });
  if (!floor) throw new ApiError(422, 'The selected floor does not belong to this property');
  return floor;
}

async function manageableUnit(user, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Rental unit not found');
  const unit = await RentalUnit.findById(id);
  if (!unit) throw new ApiError(404, 'Rental unit not found');
  const property = await propertyManagedBy(user, unit.property);
  return { unit, property };
}

function unitCreatePayload(body, property, floor, userId) {
  const roomNumber = requiredText(body.roomNumber, 'Room number/name', 80);
  const visibility = body.visibility === 'public' ? 'public' : 'private';
  const publicationStatus = visibility === 'public' ? 'published' : 'draft';
  const pricing = normalizePricing(body.pricing || {});
  validatePublishedPricing({ visibility, publicationStatus, pricing });
  const requestedStatus = String(body.availabilityStatus || 'AVAILABLE').toUpperCase();
  const availabilityStatus = ['AVAILABLE', 'MAINTENANCE', 'BLOCKED'].includes(requestedStatus) ? requestedStatus : 'AVAILABLE';
  return {
    property: property._id,
    floor: floor?._id,
    landlord: property.owner,
    roomNumber,
    roomNumberKey: roomNumber.toLocaleLowerCase('en-IN'),
    name: requiredText(body.name || roomNumber, 'Room name'),
    referenceNumber: optionalText(body.referenceNumber || `RU-${String(property._id).slice(-5)}-${roomNumber}`, 80),
    specifications: pick(body.specifications || {}, SPECIFICATION_FIELDS),
    amenities: Array.isArray(body.amenities) ? body.amenities.map((item) => optionalText(item, 120)).filter(Boolean) : [],
    primaryImage: normalizePrimaryImage(body.primaryImage),
    gallery: normalizeGallery(body.gallery || []),
    pricing,
    visibility,
    publicationStatus,
    availabilityStatus,
    statusHistory: [{ to: availabilityStatus, reason: 'Rental unit created', changedBy: userId, changedAt: new Date() }],
    createdBy: userId,
    updatedBy: userId,
  };
}

function floorTree(property, floors, units) {
  if (!property.floorManagementEnabled) return { mode: 'flat', units };
  return {
    mode: 'floor',
    floors: floors.map((floor) => ({ ...floor, units: units.filter((unit) => sameId(unit.floor, floor._id)) })),
    unassignedUnits: units.filter((unit) => !unit.floor),
  };
}

export const getRentalStructure = asyncHandler(async (req, res) => {
  const property = await propertyManagedBy(req.user, req.params.propertyId);
  const [floors, units, summary] = await Promise.all([
    PropertyFloor.find({ property: property._id, status: { $ne: 'archived' } }).sort({ floorNumber: 1, sortOrder: 1 }).lean(),
    RentalUnit.find({ property: property._id, availabilityStatus: { $ne: 'ARCHIVED' } })
      .populate('floor', 'floorNumber floorName floorCode')
      .populate('currentTenantId', 'name email phone')
      .populate('currentTenancyId', 'tenancyNumber status startDate endDate monthlyRent')
      .sort({ roomNumberKey: 1 }).lean(),
    syncPropertyRentalSummary(property._id),
  ]);
  res.json({ success: true, data: { property: property.toObject(), summary, ...floorTree(property, floors, units) } });
});

const LIVE_TENANCY_STATUSES = new Set([
  'reserved', 'application_pending', 'deposit_pending', 'agreement_pending', 'payment_pending',
  'active', 'notice', 'notice_period', 'vacating', 'move_out', 'move_out_inspection',
  'final_calculation', 'landlord_review', 'final_payment', 'deposit_settlement',
]);

export const getPropertyFloorOverview = asyncHandler(async (req, res) => {
  const property = await propertyManagedBy(req.user, req.params.propertyId);
  if (!property.floorManagementEnabled) throw new ApiError(409, 'Floor-wise room management is disabled for this property');
  if (!mongoose.isValidObjectId(req.params.floorId)) throw new ApiError(404, 'Floor not found');
  const floor = await PropertyFloor.findOne({ _id: req.params.floorId, property: property._id, status: { $ne: 'archived' } }).lean();
  if (!floor) throw new ApiError(404, 'Floor not found');

  const rooms = await RentalUnit.find({ property: property._id, floor: floor._id, availabilityStatus: { $ne: 'ARCHIVED' } })
    .populate('floor', 'floorNumber floorName floorCode status')
    .populate('currentTenantId', 'name email phone')
    .populate('currentTenancyId', 'tenancyNumber status startDate endDate monthlyRent securityDeposit')
    .sort({ roomNumberKey: 1 }).lean();
  const roomIds = rooms.map((room) => room._id);
  const tenancies = roomIds.length ? await Tenancy.find({ rentalUnit: { $in: roomIds } })
    .populate('tenant', 'name email phone')
    .populate('agreement', 'status renderedTitle cycleStartedAt cycleEndsAt')
    .sort({ startDate: -1, createdAt: -1 }).lean() : [];
  const historyByRoom = new Map();
  for (const tenancy of tenancies) {
    const key = String(tenancy.rentalUnit || '');
    if (!historyByRoom.has(key)) historyByRoom.set(key, []);
    historyByRoom.get(key).push(tenancy);
  }
  const roomRows = rooms.map((room) => {
    const history = historyByRoom.get(String(room._id)) || [];
    const current = history.find((tenancy) => sameId(tenancy._id, room.currentTenancyId))
      || history.find((tenancy) => LIVE_TENANCY_STATUSES.has(String(tenancy.status || '')))
      || null;
    return {
      ...room,
      currentTenant: current?.tenant || room.currentTenantId || null,
      currentTenancy: current || room.currentTenancyId || null,
      tenancyHistory: history,
      historyCount: history.length,
    };
  });
  const statusCount = (statuses) => roomRows.filter((room) => statuses.includes(String(room.availabilityStatus || ''))).length;
  res.json({
    success: true,
    data: {
      property: property.toObject(),
      floor,
      rooms: roomRows,
      summary: {
        totalRooms: roomRows.length,
        occupiedRooms: statusCount(['OCCUPIED', 'NOTICE_PERIOD', 'VACATING']),
        availableRooms: statusCount(['AVAILABLE', 'APPLICATION_PENDING']),
        maintenanceRooms: statusCount(['MAINTENANCE']),
        blockedRooms: statusCount(['BLOCKED']),
        historicalTenancies: roomRows.reduce((total, room) => total + room.historyCount, 0),
      },
    },
  });
});

export const streamManagedRentalUnitImage = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.fileId)) throw new ApiError(404, 'Room image not found');
  const { unit } = await manageableUnit(req.user, req.params.unitId);
  const fileId = String(req.params.fileId);
  const attached = [unit.primaryImage, ...(unit.gallery || [])]
    .some((image) => String(image?.file?._id || image?.file || '') === fileId);
  if (!attached) throw new ApiError(404, 'Room image not found');
  const file = await DriveFile.findOne({
    _id: fileId,
    owner: unit.landlord,
    status: { $nin: ['trashed', 'quarantined'] },
    mimeType: /^image\//i,
  }).select('+storageKey').lean();
  if (!file) throw new ApiError(404, 'Room image is unavailable');
  const image = [unit.primaryImage, ...(unit.gallery || [])]
    .find((item) => String(item?.file?._id || item?.file || '') === fileId);
  await sendStoredFile(req, res, { ...file, name: image?.name || file.name }, { download: false });
});

export const createPropertyFloor = asyncHandler(async (req, res) => {
  const property = await propertyManagedBy(req.user, req.params.propertyId);
  if (!property.floorManagementEnabled) throw new ApiError(409, 'Enable floor-wise room management before adding floors');
  const floorNumber = Number(req.body.floorNumber);
  if (!Number.isInteger(floorNumber) || floorNumber < -10 || floorNumber > 300) throw new ApiError(422, 'Floor number must be a whole number between -10 and 300');
  const floor = await PropertyFloor.create({
    property: property._id, landlord: property.owner, floorNumber,
    floorName: requiredText(req.body.floorName || (floorNumber === 0 ? 'Ground Floor' : `Floor ${floorNumber}`), 'Floor name', 120),
    floorCode: optionalText(req.body.floorCode, 40), sortOrder: Number(req.body.sortOrder ?? floorNumber),
    createdBy: req.user._id, updatedBy: req.user._id,
  });
  await writeAudit(req, { action: 'create', module: 'property-floors', recordId: floor._id, updatedValue: floor.toObject() });
  res.status(201).json({ success: true, data: floor });
});

export const updatePropertyFloor = asyncHandler(async (req, res) => {
  const floor = await PropertyFloor.findById(req.params.floorId);
  if (!floor) throw new ApiError(404, 'Floor not found');
  await propertyManagedBy(req.user, floor.property);
  const previousValue = floor.toObject();
  if (req.body.floorNumber !== undefined) {
    const floorNumber = Number(req.body.floorNumber);
    if (!Number.isInteger(floorNumber) || floorNumber < -10 || floorNumber > 300) throw new ApiError(422, 'Floor number must be a whole number between -10 and 300');
    const duplicate = await PropertyFloor.exists({ property: floor.property, floorNumber, _id: { $ne: floor._id } });
    if (duplicate) throw new ApiError(409, 'Another floor already uses this floor number');
    floor.floorNumber = floorNumber;
  }
  if (req.body.floorName !== undefined) floor.floorName = requiredText(req.body.floorName, 'Floor name', 120);
  if (req.body.floorCode !== undefined) floor.floorCode = optionalText(req.body.floorCode, 40);
  if (req.body.sortOrder !== undefined) floor.sortOrder = Number(req.body.sortOrder || 0);
  if (req.body.status === 'disabled' || req.body.status === 'active') floor.status = req.body.status;
  floor.updatedBy = req.user._id;
  await floor.save();
  await writeAudit(req, { action: 'update', module: 'property-floors', recordId: floor._id, previousValue, updatedValue: floor.toObject() });
  res.json({ success: true, data: floor });
});

export const archivePropertyFloor = asyncHandler(async (req, res) => {
  const floor = await PropertyFloor.findById(req.params.floorId);
  if (!floor) throw new ApiError(404, 'Floor not found');
  await propertyManagedBy(req.user, floor.property);
  if (await RentalUnit.exists({ floor: floor._id, availabilityStatus: { $ne: 'ARCHIVED' } })) {
    throw new ApiError(409, 'Archive or move every room on this floor first');
  }
  const previousValue = floor.toObject();
  floor.status = 'archived'; floor.archivedAt = new Date(); floor.updatedBy = req.user._id;
  await floor.save();
  await writeAudit(req, { action: 'archive', module: 'property-floors', recordId: floor._id, previousValue, updatedValue: floor.toObject() });
  res.json({ success: true, data: floor });
});

export const createRentalUnit = asyncHandler(async (req, res) => {
  const property = await propertyManagedBy(req.user, req.params.propertyId);
  if (req.user.role !== 'admin') await assertLandlordLimit(property.owner, 'rooms');
  const floor = await floorForProperty(property, req.body.floor);
  const unit = await RentalUnit.create(unitCreatePayload(req.body, property, floor, req.user._id));
  await syncPropertyRentalSummary(property._id, req.user._id);
  await writeAudit(req, { action: 'create', module: 'rental-units', recordId: unit._id, updatedValue: unit.toObject() });
  res.status(201).json({ success: true, data: unit });
});

export const updateRentalUnit = asyncHandler(async (req, res) => {
  const { unit, property } = await manageableUnit(req.user, req.params.unitId);
  if (unit.availabilityStatus === 'ARCHIVED') throw new ApiError(409, 'Archived rooms are read-only');
  const previousValue = unit.toObject();
  if (req.body.floor !== undefined) unit.floor = (await floorForProperty(property, req.body.floor))?._id || null;
  if (req.body.roomNumber !== undefined) unit.roomNumber = requiredText(req.body.roomNumber, 'Room number/name', 80);
  if (req.body.name !== undefined) unit.name = requiredText(req.body.name, 'Room name');
  if (req.body.specifications !== undefined) unit.specifications = { ...(unit.specifications?.toObject?.() || unit.specifications || {}), ...pick(req.body.specifications, SPECIFICATION_FIELDS) };
  if (req.body.amenities !== undefined) unit.amenities = Array.isArray(req.body.amenities) ? req.body.amenities.map((item) => optionalText(item, 120)).filter(Boolean) : [];
  if (req.body.primaryImage !== undefined) unit.primaryImage = normalizePrimaryImage(req.body.primaryImage);
  if (req.body.gallery !== undefined) unit.gallery = normalizeGallery(req.body.gallery);
  if (req.body.pricing !== undefined) unit.pricing = { ...(unit.pricing?.toObject?.() || unit.pricing || {}), ...normalizePricing(req.body.pricing) };
  if (req.body.visibility !== undefined) unit.visibility = req.body.visibility === 'public' ? 'public' : 'private';
  unit.publicationStatus = unit.visibility === 'public' ? 'published' : 'draft';
  validatePublishedPricing(unit);
  unit.updatedBy = req.user._id;
  await unit.save();
  await syncPropertyRentalSummary(property._id, req.user._id);
  await writeAudit(req, { action: 'update', module: 'rental-units', recordId: unit._id, previousValue, updatedValue: unit.toObject() });
  res.json({ success: true, data: unit });
});

export const duplicateRentalUnit = asyncHandler(async (req, res) => {
  const { unit, property } = await manageableUnit(req.user, req.params.unitId);
  if (req.user.role !== 'admin') await assertLandlordLimit(property.owner, 'rooms');
  const source = unit.toObject();
  const roomNumber = requiredText(req.body.roomNumber || `${source.roomNumber}-COPY`, 'New room number/name', 80);
  const duplicate = await RentalUnit.create({
    ...source, _id: undefined, roomNumber, roomNumberKey: roomNumber.toLocaleLowerCase('en-IN'),
    name: requiredText(req.body.name || `${source.name} Copy`, 'Room name'), referenceNumber: `RU-${String(property._id).slice(-5)}-${roomNumber}`,
    visibility: 'private', publicationStatus: 'draft', availabilityStatus: 'AVAILABLE', isAvailable: true,
    currentTenancyId: undefined, currentTenantId: undefined, activeApplicationCount: 0, archivedAt: undefined, disabledAt: undefined,
    statusHistory: [{ to: 'AVAILABLE', reason: `Duplicated from ${unit.roomNumber}`, changedBy: req.user._id, changedAt: new Date() }],
    createdAt: undefined, updatedAt: undefined, createdBy: req.user._id, updatedBy: req.user._id,
  });
  await syncPropertyRentalSummary(property._id, req.user._id);
  await writeAudit(req, { action: 'duplicate', module: 'rental-units', recordId: duplicate._id, updatedValue: duplicate.toObject() });
  res.status(201).json({ success: true, data: duplicate });
});

export const changeRentalUnitStatus = asyncHandler(async (req, res) => {
  const { unit, property } = await manageableUnit(req.user, req.params.unitId);
  const status = String(req.body.status || '').toUpperCase();
  if (!UNIT_STATUSES.has(status)) throw new ApiError(422, 'Invalid rental unit availability status');
  if (['OCCUPIED', 'NOTICE_PERIOD', 'VACATING'].includes(status)) throw new ApiError(409, 'Use the tenancy workflow to set this occupancy status');
  if (unit.currentTenancyId || unit.currentTenantId) throw new ApiError(409, 'A room with an active tenancy lock cannot be changed manually');
  const previousValue = unit.toObject();
  await transitionRentalUnit(unit, status, { actorId: req.user._id, reason: optionalText(req.body.reason, 1000) });
  await syncPropertyRentalSummary(property._id, req.user._id);
  await writeAudit(req, { action: `status:${status}`, module: 'rental-units', recordId: unit._id, previousValue, updatedValue: unit.toObject() });
  res.json({ success: true, data: unit });
});

export const applyRentalUnitPricing = asyncHandler(async (req, res) => {
  const property = await propertyManagedBy(req.user, req.params.propertyId);
  const unitIds = [...new Set((Array.isArray(req.body.unitIds) ? req.body.unitIds : []).map(String).filter((id) => mongoose.isValidObjectId(id)))];
  if (!unitIds.length) throw new ApiError(422, 'Select at least one room');
  const pricing = normalizePricing(req.body.pricing || {});
  const units = await RentalUnit.find({ _id: { $in: unitIds }, property: property._id, availabilityStatus: { $ne: 'ARCHIVED' } });
  if (units.length !== unitIds.length) throw new ApiError(422, 'One or more selected rooms do not belong to this property');
  for (const unit of units) {
    const merged = { ...(unit.pricing?.toObject?.() || unit.pricing || {}), ...pricing };
    validatePublishedPricing({ visibility: unit.visibility, publicationStatus: unit.publicationStatus, pricing: merged });
    unit.pricing = merged; unit.updatedBy = req.user._id;
    await unit.save();
  }
  await syncPropertyRentalSummary(property._id, req.user._id);
  await writeAudit(req, { action: 'bulk-pricing', module: 'rental-units', recordId: property._id, updatedValue: { unitIds, pricing } });
  res.json({ success: true, data: { updated: units.length } });
});

function occupancyStatusFilter(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'occupied') return ['OCCUPIED'];
  if (normalized === 'available') return ['AVAILABLE', 'APPLICATION_PENDING'];
  if (normalized === 'agreement_pending') return ['AGREEMENT_PENDING', 'PAYMENT_PENDING'];
  if (normalized === 'notice_period') return ['NOTICE_PERIOD', 'VACATING'];
  return null;
}

export const getPropertyOccupancy = asyncHandler(async (req, res) => {
  const property = await propertyManagedBy(req.user, req.params.propertyId);
  const unitFilter = { property: property._id, availabilityStatus: { $ne: 'ARCHIVED' } };
  if (mongoose.isValidObjectId(req.query.floor)) unitFilter.floor = req.query.floor;
  if (req.query.room) unitFilter.roomNumber = new RegExp(String(req.query.room).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const statuses = occupancyStatusFilter(req.query.status);
  if (statuses) unitFilter.availabilityStatus = { $in: statuses };
  const units = await RentalUnit.find(unitFilter).populate('floor', 'floorName floorNumber').sort({ roomNumberKey: 1 }).lean();
  const unitIds = units.map((unit) => unit._id);
  const tenancyIds = units.map((unit) => unit.currentTenancyId).filter(Boolean);
  const tenancies = unitIds.length ? await Tenancy.find({
    $or: [{ _id: { $in: tenancyIds } }, { rentalUnit: { $in: unitIds }, status: { $nin: ['closed', 'completed', 'cancelled'] } }],
  }).populate('tenant', 'name email phone').populate('agreement', 'status renderedTitle').sort({ createdAt: -1 }).lean() : [];
  const tenancyMap = new Map();
  tenancies.forEach((tenancy) => {
    tenancyMap.set(String(tenancy._id), tenancy);
    if (tenancy.rentalUnit && !tenancyMap.has(`unit:${tenancy.rentalUnit}`)) tenancyMap.set(`unit:${tenancy.rentalUnit}`, tenancy);
  });
  const allTenancyIds = tenancies.map((tenancy) => tenancy._id);
  const [cycles, historyCounts] = await Promise.all([
    allTenancyIds.length ? RentCycle.find({ tenancy: { $in: allTenancyIds } }).sort({ cycleMonth: -1 }).populate('invoice', 'invoiceNumber status totalAmount paidAmount balanceAmount').lean() : [],
    unitIds.length ? Tenancy.aggregate([{ $match: { rentalUnit: { $in: unitIds } } }, { $group: { _id: '$rentalUnit', count: { $sum: 1 } } }]) : [],
  ]);
  const currentCycle = new Map();
  cycles.forEach((cycle) => { if (!currentCycle.has(String(cycle.tenancy))) currentCycle.set(String(cycle.tenancy), cycle); });
  const historyCountMap = new Map(historyCounts.map((item) => [String(item._id), item.count]));
  const rows = units.map((unit) => {
    const tenancy = tenancyMap.get(String(unit.currentTenancyId || '')) || tenancyMap.get(`unit:${unit._id}`) || null;
    const cycle = tenancy ? currentCycle.get(String(tenancy._id)) || null : null;
    return {
      ...unit,
      unit,
      currentTenant: tenancy?.tenant || unit.currentTenantId || null,
      tenancy,
      agreementStatus: tenancy?.agreement?.status || null,
      currentCycle: cycle,
      outstandingAmount: Number(cycle?.outstandingAmount ?? cycle?.invoice?.balanceAmount ?? 0),
      historyCount: Number(historyCountMap.get(String(unit._id)) || 0),
    };
  });
  res.json({ success: true, data: { property: property.toObject(), rows } });
});

export const getRentalUnitTenancyDetail = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.unitId)) throw new ApiError(404, 'Rental unit not found');
  const unit = await RentalUnit.findById(req.params.unitId).populate('floor', 'floorName floorNumber').lean();
  if (!unit) throw new ApiError(404, 'Rental unit not found');
  const property = await propertyManagedBy(req.user, unit.property);
  const history = await Tenancy.find({ rentalUnit: unit._id })
    .populate('tenant', 'name email phone')
    .populate('agreement', 'status renderedTitle cycleStartedAt cycleEndsAt')
    .populate('application', 'applicationNumber status')
    .sort({ createdAt: -1 }).lean();
  const tenancyIds = history.map((item) => item._id);
  const [cycles, invoices, payments] = await Promise.all([
    RentCycle.find({ tenancy: { $in: tenancyIds } }).sort({ cycleMonth: -1 }).populate('invoice').lean(),
    RentalInvoice.find({ tenancy: { $in: tenancyIds } }).sort({ billingMonth: -1 }).lean(),
    Payment.find({ tenancy: { $in: tenancyIds } }).sort({ createdAt: -1 }).lean(),
  ]);
  const current = history.find((item) => sameId(item._id, unit.currentTenancyId)) || null;
  res.json({ success: true, data: { property: property.toObject(), unit, current, history, cycles, invoices, payments } });
});

export const startRentalTenancy = asyncHandler(async (req, res) => {
  const { unit, property } = await manageableUnit(req.user, req.params.unitId);
  if (!['PAYMENT_PENDING', 'APPLICATION_PENDING'].includes(unit.availabilityStatus)) throw new ApiError(409, 'This room is not waiting for tenancy activation');
  const tenancy = await Tenancy.findOne({ _id: req.body.tenancyId, rentalUnit: unit._id, landlord: property.owner, status: 'payment_pending' });
  if (!tenancy) throw new ApiError(404, 'Payment-pending tenancy not found for this room');
  const agreement = await AgreementRequest.findOne({ _id: tenancy.agreement, tenancy: tenancy._id, status: 'approved' });
  if (!agreement) throw new ApiError(409, 'The signed agreement must be approved before starting the rent workflow');
  const paidInitialInvoice = await RentalInvoice.findOne({ tenancy: tenancy._id, status: 'paid', balanceAmount: { $lte: 0 } }).sort({ createdAt: 1 });
  if (!paidInitialInvoice) throw new ApiError(409, 'Verify the required initial payment before starting the rent workflow');
  if (unit.availabilityStatus === 'APPLICATION_PENDING') {
    await transitionRentalUnitToPaymentPending(unit, {
      actorId: req.user._id,
      reason: 'Verified rent workflow reconciled the room state before activation',
    });
  }
  const previousValue = tenancy.toObject();
  const now = new Date();
  tenancy.status = 'active'; tenancy.startDate ||= now; tenancy.statusHistory.push({ from: 'payment_pending', to: 'active', reason: 'Landlord verified payment and started rent workflow', changedBy: req.user._id, changedAt: now }); tenancy.updatedBy = req.user._id;
  await tenancy.save();
  await transitionRentalUnit(unit, 'OCCUPIED', { actorId: req.user._id, tenancyId: tenancy._id, tenantId: tenancy.tenant, reason: 'Agreement and required initial payment completed' });
  await syncPropertyRentalSummary(property._id, req.user._id);
  await Application.updateOne({ _id: tenancy.application }, { $set: { status: 'completed', updatedBy: req.user._id } });
  await createNotification({ user: tenancy.tenant, title: 'Rent workflow started', message: `${unit.name} is now active in your tenancy workspace.`, category: 'lease', actionUrl: '/app/my-property', metadata: { tenancyId: tenancy._id, rentalUnitId: unit._id } });
  await writeAudit(req, { action: 'activate', module: 'tenancies', recordId: tenancy._id, previousValue, updatedValue: tenancy.toObject() });
  res.json({ success: true, data: { tenancy, unit }, message: 'Payment verified and room tenancy started.' });
});

const TENANCY_ACTIONS = Object.freeze({
  serve_notice: { from: ['active'], to: 'notice_period', unit: 'NOTICE_PERIOD' },
  withdraw_notice: { from: ['notice_period'], to: 'active', unit: 'OCCUPIED' },
  start_vacating: { from: ['notice_period'], to: 'vacating', unit: 'VACATING' },
  move_out_inspection: { from: ['vacating'], to: 'move_out_inspection' },
  calculate_final_outstanding: { from: ['move_out_inspection'], to: 'final_calculation' },
  landlord_review: { from: ['final_calculation'], to: 'landlord_review' },
  record_final_payment: { from: ['landlord_review'], to: 'final_payment' },
  settle_deposit: { from: ['final_payment'], to: 'deposit_settlement' },
  close_tenancy: { from: ['deposit_settlement'], to: 'closed' },
});

export const transitionRentalTenancy = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.tenancyId)) throw new ApiError(404, 'Tenancy not found');
  const tenancy = await Tenancy.findById(req.params.tenancyId);
  if (!tenancy || !tenancy.rentalUnit) throw new ApiError(404, 'Room tenancy not found');
  await propertyManagedBy(req.user, tenancy.property);
  const unit = await RentalUnit.findOne({ _id: tenancy.rentalUnit, property: tenancy.property });
  if (!unit) throw new ApiError(404, 'Rental unit not found');
  const action = String(req.body.action || '');
  const rule = TENANCY_ACTIONS[action];
  if (!rule) throw new ApiError(422, 'Invalid tenancy workflow action');
  if (!rule.from.includes(tenancy.status)) throw new ApiError(409, `Action ${action.replaceAll('_', ' ')} is not available while tenancy is ${tenancy.status.replaceAll('_', ' ')}`);
  const previousValue = tenancy.toObject();
  const now = new Date();
  if (action === 'serve_notice') tenancy.notices.push({ type: req.body.noticeType || 'move_out', title: req.body.title || 'Notice period started', message: optionalText(req.body.reason, 2000), servedAt: now, effectiveAt: req.body.effectiveAt, file: req.body.file, createdBy: req.user._id });
  if (action === 'move_out_inspection') tenancy.moveOutInspection = { completedAt: now, completedBy: req.user._id, notes: optionalText(req.body.notes, 2000), evidence: Array.isArray(req.body.evidence) ? req.body.evidence.filter((id) => mongoose.isValidObjectId(id)) : [] };
  if (action === 'calculate_final_outstanding') tenancy.moveOutSettlement = { ...(tenancy.moveOutSettlement?.toObject?.() || tenancy.moveOutSettlement || {}), outstandingAmount: Math.max(0, Number(req.body.outstandingAmount || 0)), deductions: Array.isArray(req.body.deductions) ? req.body.deductions : [], depositAmount: Math.max(0, Number(req.body.depositAmount ?? tenancy.securityDeposit ?? 0)), refundAmount: Math.max(0, Number(req.body.refundAmount || 0)), finalPaymentAmount: Math.max(0, Number(req.body.finalPaymentAmount || 0)), status: 'calculated' };
  if (action === 'landlord_review') tenancy.moveOutSettlement.status = 'reviewed';
  if (action === 'record_final_payment') tenancy.moveOutSettlement.status = 'payment_pending';
  if (action === 'settle_deposit') { tenancy.moveOutSettlement.status = 'deposit_settled'; tenancy.moveOutSettlement.settledAt = now; }
  tenancy.statusHistory.push({ from: tenancy.status, to: rule.to, reason: optionalText(req.body.reason, 1000), changedBy: req.user._id, changedAt: now });
  tenancy.status = rule.to; tenancy.updatedBy = req.user._id;
  if (action === 'close_tenancy') { tenancy.closedAt = now; tenancy.closedBy = req.user._id; tenancy.endDate ||= now; tenancy.moveOutSettlement.status = 'closed'; }
  await tenancy.save();
  if (rule.unit) await transitionRentalUnit(unit, rule.unit, { actorId: req.user._id, reason: optionalText(req.body.reason, 1000) || action.replaceAll('_', ' ') });
  if (action === 'close_tenancy') await releaseRentalUnitAfterClosedTenancy(unit, tenancy, req.user._id);
  await writeAudit(req, { action, module: 'tenancies', recordId: tenancy._id, previousValue, updatedValue: tenancy.toObject() });
  res.json({ success: true, data: { tenancy, unit }, message: `Tenancy moved to ${rule.to.replaceAll('_', ' ')}.` });
});

function exactIdFilter(query) {
  const filter = {};
  if (mongoose.isValidObjectId(query.propertyId)) filter.property = query.propertyId;
  if (mongoose.isValidObjectId(query.landlordId)) filter.landlord = query.landlordId;
  if (mongoose.isValidObjectId(query.tenantId)) filter.tenant = query.tenantId;
  if (mongoose.isValidObjectId(query.roomId)) filter.rentalUnit = query.roomId;
  if (mongoose.isValidObjectId(query.tenancyId)) filter._id = query.tenancyId;
  if (mongoose.isValidObjectId(query.agreementId)) filter.agreement = query.agreementId;
  return filter;
}

export const getAdminRentalManagement = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Administrator access required');
  const filter = exactIdFilter(req.query);
  if (req.query.status) filter.status = String(req.query.status).toLowerCase();
  if (mongoose.isValidObjectId(req.query.invoiceId)) {
    const invoice = await RentalInvoice.findById(req.query.invoiceId).select('tenancy').lean();
    filter._id = invoice?.tenancy || new mongoose.Types.ObjectId();
  }
  if (mongoose.isValidObjectId(req.query.rentCycleId)) {
    const cycle = await RentCycle.findById(req.query.rentCycleId).select('tenancy').lean();
    filter._id = cycle?.tenancy || new mongoose.Types.ObjectId();
  }
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
  const tenancies = await Tenancy.find(filter)
    .populate('property', 'title code address')
    .populate('rentalUnit', 'roomNumber name availabilityStatus pricing floor')
    .populate('landlord', 'name email phone')
    .populate('tenant', 'name email phone')
    .populate('agreement', 'status renderedTitle cycleStartedAt cycleEndsAt')
    .sort({ createdAt: -1 }).limit(limit).lean();
  const unitIds = tenancies.map((item) => item.rentalUnit?._id || item.rentalUnit).filter(Boolean);
  const tenancyIds = tenancies.map((item) => item._id);
  const [floors, cycles, invoices, payments, bookingHistory, historyCounts] = await Promise.all([
    PropertyFloor.find({ _id: { $in: tenancies.map((item) => item.rentalUnit?.floor).filter(Boolean) } }).lean(),
    RentCycle.find({ tenancy: { $in: tenancyIds } }).sort({ cycleMonth: -1 }).lean(),
    RentalInvoice.find({ tenancy: { $in: tenancyIds } }).sort({ billingMonth: -1 }).lean(),
    Payment.find({ tenancy: { $in: tenancyIds } }).sort({ createdAt: -1 }).lean(),
    Application.find({ rentalUnit: { $in: unitIds } }).select('rentalUnit applicant status applicationNumber moveInDate createdAt acceptedAt rejectedAt').populate('applicant', 'name email phone').sort({ createdAt: -1 }).lean(),
    Tenancy.aggregate([{ $match: { rentalUnit: { $in: unitIds } } }, { $group: { _id: '$rentalUnit', count: { $sum: 1 } } }]),
  ]);
  const floorMap = new Map(floors.map((item) => [String(item._id), item]));
  const latestCycle = new Map(); cycles.forEach((item) => { if (!latestCycle.has(String(item.tenancy))) latestCycle.set(String(item.tenancy), item); });
  const invoiceMap = new Map(invoices.map((item) => [String(item._id), item]));
  const countMap = new Map(historyCounts.map((item) => [String(item._id), item.count]));
  const paymentsByTenancy = new Map(); payments.forEach((item) => { const key = String(item.tenancy || ''); if (!paymentsByTenancy.has(key)) paymentsByTenancy.set(key, []); paymentsByTenancy.get(key).push(item); });
  const bookingsByUnit = new Map(); bookingHistory.forEach((item) => { const key = String(item.rentalUnit || ''); if (!bookingsByUnit.has(key)) bookingsByUnit.set(key, []); bookingsByUnit.get(key).push(item); });
  const rows = tenancies.map((tenancy) => {
    const cycle = latestCycle.get(String(tenancy._id));
    const invoice = cycle?.invoice ? invoiceMap.get(String(cycle.invoice)) : invoices.find((item) => sameId(item.tenancy, tenancy._id));
    const roomId = String(tenancy.rentalUnit?._id || tenancy.rentalUnit);
    return { ...tenancy, floor: floorMap.get(String(tenancy.rentalUnit?.floor || '')) || null, currentRentCycle: cycle || null, currentInvoice: invoice || null, outstandingAmount: Number(cycle?.outstandingAmount ?? invoice?.balanceAmount ?? 0), previousTenants: Math.max(0, Number(countMap.get(roomId) || 1) - (tenancy.status === 'closed' ? 0 : 1)), paymentHistory: paymentsByTenancy.get(String(tenancy._id)) || [], invoiceHistory: invoices.filter((item) => sameId(item.tenancy, tenancy._id)), bookingHistory: bookingsByUnit.get(roomId) || [], inspectionStatus: { moveIn: tenancy.moveInInspection?.completedAt ? 'completed' : 'pending', moveOut: tenancy.moveOutInspection?.completedAt ? 'completed' : 'pending' } };
  });
  res.json({ success: true, data: rows, total: rows.length });
});
