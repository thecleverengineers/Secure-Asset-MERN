import mongoose from 'mongoose';
import { Property, RentalUnit } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { capabilityRolesForUser } from './rbac.js';

export const UNIT_TRANSITIONS = Object.freeze({
  AVAILABLE: ['APPLICATION_PENDING', 'RESERVED', 'MAINTENANCE', 'BLOCKED', 'ARCHIVED'],
  APPLICATION_PENDING: ['AVAILABLE', 'RESERVED', 'AGREEMENT_PENDING', 'MAINTENANCE', 'BLOCKED', 'ARCHIVED'],
  RESERVED: ['AVAILABLE', 'AGREEMENT_PENDING', 'PAYMENT_PENDING', 'BLOCKED', 'ARCHIVED'],
  AGREEMENT_PENDING: ['AVAILABLE', 'PAYMENT_PENDING', 'BLOCKED'],
  PAYMENT_PENDING: ['AVAILABLE', 'OCCUPIED', 'BLOCKED'],
  OCCUPIED: ['NOTICE_PERIOD'],
  NOTICE_PERIOD: ['OCCUPIED', 'VACATING'],
  VACATING: ['AVAILABLE', 'MAINTENANCE', 'BLOCKED'],
  MAINTENANCE: ['AVAILABLE', 'BLOCKED', 'ARCHIVED'],
  BLOCKED: ['AVAILABLE', 'MAINTENANCE', 'ARCHIVED'],
  ARCHIVED: [],
});

export const ACCEPTING_APPLICATION_STATUSES = Object.freeze(['AVAILABLE', 'APPLICATION_PENDING']);
export const PUBLICLY_VISIBLE_UNIT_STATUSES = Object.freeze(['AVAILABLE', 'APPLICATION_PENDING']);

function sameId(left, right) {
  return Boolean(left && right && String(left?._id || left) === String(right?._id || right));
}

export async function propertyManagedBy(user, propertyId, { rentOnly = true } = {}) {
  if (!mongoose.isValidObjectId(propertyId)) throw new ApiError(404, 'Property not found');
  const property = await Property.findOne({ _id: propertyId, deletedAt: null });
  if (!property) throw new ApiError(404, 'Property not found');
  if (rentOnly && String(property.listingType || property.purpose) !== 'rent') {
    throw new ApiError(409, 'Manage Rooms is available only for rent properties');
  }
  const admin = String(user?.role || '').toLowerCase() === 'admin';
  const landlord = capabilityRolesForUser(user).includes('landlord') && sameId(property.owner, user?._id);
  const manager = String(user?.role || '').toLowerCase() === 'manager'
    && (sameId(property.manager, user?._id) || (user?.assignedProperties || []).some((id) => sameId(id, property._id)));
  if (!admin && !landlord && !manager) throw new ApiError(403, 'You cannot manage rental units for this property');
  return property;
}

export function canAcceptRentalApplication(unit) {
  return unit
    && unit.visibility === 'public'
    && unit.publicationStatus === 'published'
    && ACCEPTING_APPLICATION_STATUSES.includes(String(unit.availabilityStatus || ''));
}

export function assertRentalUnitTransition(currentStatus, nextStatus) {
  const current = String(currentStatus || 'AVAILABLE');
  const next = String(nextStatus || '');
  if (current === next) return;
  if (!(UNIT_TRANSITIONS[current] || []).includes(next)) {
    throw new ApiError(409, `Rental unit cannot move from ${current.replaceAll('_', ' ')} to ${next.replaceAll('_', ' ')}`);
  }
}

export async function transitionRentalUnit(unit, nextStatus, { actorId, reason = '', tenancyId, tenantId, allowSame = true } = {}) {
  const current = String(unit.availabilityStatus || 'AVAILABLE');
  const next = String(nextStatus || '').toUpperCase();
  if (current === next && allowSame) return unit;
  assertRentalUnitTransition(current, next);

  if (next === 'OCCUPIED' && (!mongoose.isValidObjectId(tenancyId) || !mongoose.isValidObjectId(tenantId))) {
    throw new ApiError(409, 'An occupied room must reference its active tenancy and tenant');
  }
  if (next === 'AVAILABLE' && current === 'VACATING' && (unit.currentTenancyId || unit.currentTenantId)) {
    throw new ApiError(409, 'Close the tenancy and clear the room lock before releasing this room');
  }

  unit.availabilityStatus = next;
  if (next === 'OCCUPIED') {
    unit.currentTenancyId = tenancyId;
    unit.currentTenantId = tenantId;
  }
  if (next === 'ARCHIVED') {
    unit.archivedAt = new Date();
    unit.publicationStatus = 'archived';
    unit.visibility = 'private';
  }
  if (next === 'BLOCKED') unit.disabledAt = new Date();
  if (current === 'BLOCKED' && next !== 'BLOCKED') unit.disabledAt = undefined;
  unit.statusHistory.push({ from: current, to: next, reason, changedBy: actorId, changedAt: new Date() });
  unit.updatedBy = actorId;
  await unit.save();
  return unit;
}

// Older or interrupted agreement workflows can leave a room in
// APPLICATION_PENDING even though the selected application has completed
// signing and the landlord is approving the agreement. Preserve the canonical
// state history instead of attempting an invalid direct transition.
export async function transitionRentalUnitToPaymentPending(unit, options = {}) {
  const current = String(unit?.availabilityStatus || 'AVAILABLE');
  if (current === 'PAYMENT_PENDING') return unit;
  if (current === 'APPLICATION_PENDING') {
    await transitionRentalUnit(unit, 'AGREEMENT_PENDING', {
      ...options,
      reason: options.reason || 'Accepted agreement workflow reconciled the room state',
    });
  }
  return transitionRentalUnit(unit, 'PAYMENT_PENDING', options);
}

export async function syncPropertyRentalSummary(propertyId, actorId = null) {
  if (!mongoose.isValidObjectId(propertyId)) return null;
  const [totalUnits, availableUnits, occupiedUnits, starting] = await Promise.all([
    RentalUnit.countDocuments({ property: propertyId, availabilityStatus: { $ne: 'ARCHIVED' } }),
    RentalUnit.countDocuments({ property: propertyId, visibility: 'public', publicationStatus: 'published', availabilityStatus: { $in: PUBLICLY_VISIBLE_UNIT_STATUSES } }),
    RentalUnit.countDocuments({ property: propertyId, availabilityStatus: 'OCCUPIED' }),
    RentalUnit.findOne({ property: propertyId, visibility: 'public', publicationStatus: 'published', availabilityStatus: { $in: PUBLICLY_VISIBLE_UNIT_STATUSES } })
      .sort({ 'pricing.monthlyRent': 1 })
      .select('pricing.monthlyRent')
      .lean(),
  ]);
  let status;
  if (totalUnits > 0 && occupiedUnits === totalUnits) status = 'occupied';
  else if (availableUnits > 0 && occupiedUnits > 0) status = 'partially_occupied';
  else if (availableUnits > 0) status = 'available';
  else if (totalUnits > 0) status = 'partially_occupied';

  const update = {
    totalUnits,
    occupiedUnits,
    'rentalSummary.totalUnits': totalUnits,
    'rentalSummary.availableUnits': availableUnits,
    'rentalSummary.occupiedUnits': occupiedUnits,
    'rentalSummary.startingMonthlyRent': Number(starting?.pricing?.monthlyRent || 0),
    'rentalSummary.lastSyncedAt': new Date(),
    ...(status && { status }),
    ...(actorId && { updatedBy: actorId }),
  };
  await Property.updateOne({ _id: propertyId, deletedAt: null }, { $set: update });
  return { totalUnits, availableUnits, occupiedUnits, startingMonthlyRent: update['rentalSummary.startingMonthlyRent'], status };
}

export async function releaseRentalUnitAfterClosedTenancy(unit, tenancy, actorId, reason = 'Tenancy closed and room released') {
  if (!unit || !tenancy || !sameId(unit.currentTenancyId, tenancy._id)) {
    throw new ApiError(409, 'This tenancy is not the room’s current occupancy lock');
  }
  const current = String(unit.availabilityStatus || 'VACATING');
  if (!['NOTICE_PERIOD', 'VACATING'].includes(current)) {
    throw new ApiError(409, 'Complete the notice and vacating workflow before releasing this room');
  }
  unit.currentTenantId = undefined;
  unit.currentTenancyId = undefined;
  unit.availabilityStatus = 'AVAILABLE';
  unit.statusHistory.push({ from: current, to: 'AVAILABLE', reason, changedBy: actorId, changedAt: new Date() });
  unit.updatedBy = actorId;
  await unit.save();
  await syncPropertyRentalSummary(unit.property, actorId);
  return unit;
}
