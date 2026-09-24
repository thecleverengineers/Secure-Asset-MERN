import mongoose from 'mongoose';
import {
  User, Property, PropertySpace, PropertyMedia, Application, TenantKyc, TenantProfile, Occupant, TenantInterview, DriveFile, Document,
  PropertyVisit, Tenancy, RentalInvoice, RentalUnit, RentCycle, UtilityReading, PropertyPromotion, AuditLog, Notification,
} from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { landlordUsage, usageWithLimits, assertLandlordLimit } from '../services/landlordSubscription.js';
import { assignedPropertyIds, buildScope } from '../services/scope.js';
import { createNotification } from '../services/notifications.js';
import { capabilityRolesForUser } from '../services/rbac.js';
import { resolvePropertyMediaFile } from '../services/propertyMediaFile.js';
import { sendStoredFile } from '../utils/httpFile.js';
import { TENANT_KYC_DOCUMENT_CATEGORIES } from '../constants/tenantKyc.js';
import { assertApplicationDecisionTransition } from '../services/applicationWorkflow.js';
import { canAcceptRentalApplication, syncPropertyRentalSummary, transitionRentalUnit } from '../services/rentalUnitLifecycle.js';

function toCsv(rows) { if (!rows.length) return ''; const keys = Object.keys(rows[0]); const esc = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`; return [keys.map(esc).join(','), ...rows.map((row) => keys.map((key) => esc(row[key])).join(','))].join('\n'); }

const sameId = (a, b) => a && b && String(a?._id || a) === String(b?._id || b);
const APPROVED_PROPERTY_VISIT_STATUSES = new Set(['approved', 'rescheduled', 'confirmed', 'visitor_arrived', 'visit_in_progress', 'completed']);

function exactPropertyCoordinates(property) {
  const latitude = Number(property?.map?.latitude ?? property?.location?.coordinates?.[1]);
  const longitude = Number(property?.map?.longitude ?? property?.location?.coordinates?.[0]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

function propertyAddress(property) {
  const address = property?.address || {};
  return [address.line1, address.locality, address.city, address.state, address.country, address.postalCode]
    .map((value) => String(value || '').trim()).filter(Boolean).join(', ');
}

function canManageProperty(user, property) {
  if (user.role === 'admin') return true;
  if (user.role === 'manager') return sameId(property.manager, user._id) || (user.assignedProperties || []).some((id) => sameId(id, property._id));
  return capabilityRolesForUser(user).includes('landlord') && sameId(property.owner, user._id);
}
async function propertyForUser(user, propertyId) {
  const property = await Property.findOne({ _id: propertyId, deletedAt: null });
  if (!property || !canManageProperty(user, property)) throw new ApiError(403, 'Property management access denied');
  return property;
}

const OPEN_RENTAL_APPLICATION_STATUSES = ['submitted', 'under_review', 'shortlisted', 'interview_requested', 'interview_scheduled', 'site_visit_scheduled', 'additional_documents_requested', 'documents_pending', 'approved', 'agreement_pending', 'deposit_pending'];

async function refreshRentalUnitApplicationState(unit, actorId) {
  if (!unit) return;
  const activeApplicationCount = await Application.countDocuments({ rentalUnit: unit._id, status: { $in: OPEN_RENTAL_APPLICATION_STATUSES } });
  unit.activeApplicationCount = activeApplicationCount;
  if (activeApplicationCount > 0 && unit.availabilityStatus === 'AVAILABLE') {
    await transitionRentalUnit(unit, 'APPLICATION_PENDING', { actorId, reason: 'Tenant application received' });
  } else if (activeApplicationCount === 0 && unit.availabilityStatus === 'APPLICATION_PENDING') {
    await transitionRentalUnit(unit, 'AVAILABLE', { actorId, reason: 'No active applications remain' });
  } else {
    unit.updatedBy = actorId;
    await unit.save({ validateModifiedOnly: true });
  }
  await syncPropertyRentalSummary(unit.property, actorId);
}

export const getPropertyVisitNavigation = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.visitId)) throw new ApiError(404, 'Site visit not found');
  const visit = await PropertyVisit.findById(req.params.visitId)
    .populate('property', 'title referenceNumber address map location locationPrivacy')
    .populate('space', 'name code roomNumber apartmentNumber')
    .lean();
  if (!visit) throw new ApiError(404, 'Site visit not found');
  const isAdminOrManager = ['admin', 'manager'].includes(String(req.user.role || '').toLowerCase());
  const isLandlord = sameId(visit.landlord, req.user._id);
  const isRequester = sameId(visit.requester, req.user._id);
  if (!isAdminOrManager && !isLandlord && !isRequester) throw new ApiError(403, 'Site visit navigation access denied');

  const visitSummary = {
    id: visit._id,
    status: visit.status,
    preferredStart: visit.preferredStart,
    proposedStart: visit.proposedStart,
    confirmedStart: visit.confirmedStart,
    propertyTitle: visit.property?.title || 'Property site visit',
    spaceName: visit.space?.name || visit.space?.code || '',
  };
  const requesterNeedsApproval = String(req.user.role || '').toLowerCase() === 'tenant' && isRequester && !isLandlord && !isAdminOrManager;
  if (requesterNeedsApproval && !APPROVED_PROPERTY_VISIT_STATUSES.has(String(visit.status || ''))) {
    res.json({
      success: true,
      data: {
        available: false,
        visit: visitSummary,
        reason: 'The exact property pin is shared after the landlord or administrator confirms this site visit.',
      },
    });
    return;
  }

  const destination = exactPropertyCoordinates(visit.property);
  if (!destination) {
    res.json({
      success: true,
      data: {
        available: false,
        visit: visitSummary,
        reason: 'This property does not have an exact Google latitude and longitude yet.',
      },
    });
    return;
  }
  const destinationQuery = `${destination.latitude},${destination.longitude}`;
  res.json({
    success: true,
    data: {
      available: true,
      visit: visitSummary,
      property: { id: visit.property?._id, title: visit.property?.title, address: propertyAddress(visit.property) },
      destination,
      navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`,
      locationPrivacy: visit.property?.locationPrivacy || 'after_visit_approval',
    },
  });
});

// Resolve gallery files while the property tree is loaded. Besides giving the
// browser an explicit preview state, this repairs older PropertyMedia rows
// that were saved with only a legacy URL or Document relation. The fallback is
// restricted to this property and each recovered file is linked back to the
// media row so every later preview is deterministic.
async function preparePropertyMediaPreviews(mediaRows, propertyId) {
  const usedFallbackIds = [];
  const prepared = [];
  for (const item of mediaRows) {
    const mediaType = String(item?.mediaType || 'image').trim().toLowerCase();
    if (!['image', 'photo'].includes(mediaType) && !mediaType.startsWith('image/')) {
      prepared.push(item);
      continue;
    }
    const currentDriveFileId = String(item?.driveFile?._id || item?.driveFile || '').trim();
    const hasDirectFileReference = Boolean(item?.driveFile || item?.document || /\/(?:api\/v\d+\/)?(?:drive\/files|files)\/[a-f\d]{24}(?:\/content)?(?:[/?#]|$)/i.test(String(item?.url || item?.thumbnailUrl || '')) || /^[a-f\d]{24}$/i.test(String(item?.url || '').trim()) || /^[a-f\d]{24}$/i.test(String(item?.thumbnailUrl || '').trim()));
    const file = await resolvePropertyMediaFile(item, propertyId, hasDirectFileReference ? {} : { excludedIds: usedFallbackIds });
    if (!file) {
      prepared.push({ ...item, previewAvailable: false });
      continue;
    }
    const fileId = String(file._id);
    if (currentDriveFileId !== fileId && fileId) {
      await PropertyMedia.updateOne(
        { _id: item._id, property: propertyId, deletedAt: null },
        { $set: { driveFile: file._id } },
      );
    }
    if (!hasDirectFileReference) usedFallbackIds.push(fileId);
    prepared.push({
      ...item,
      driveFile: file._id,
      previewAvailable: true,
      previewFileId: fileId,
      previewMimeType: file.mimeType || 'image/*',
      previewFileName: file.name || file.originalName || '',
      previewRoute: `/api/v1/property-management/properties/${propertyId}/media/${item._id}/content`,
    });
  }
  return prepared;
}

export const getPropertyTree = asyncHandler(async (req, res) => {
  const property = await propertyForUser(req.user, req.params.propertyId);
  const [spaces, media, promotions, meterReadings] = await Promise.all([
    PropertySpace.find({ property: property._id, deletedAt: null }).sort({ sortOrder: 1, createdAt: 1 }).lean(),
    PropertyMedia.find({ property: property._id, deletedAt: null }).sort({ cover: -1, sortOrder: 1 }).lean(),
    PropertyPromotion.find({ property: property._id }).populate('space', 'name code roomNumber flatNumber apartmentNumber').sort({ createdAt: -1 }).lean(),
    UtilityReading.find({ property: property._id }).populate('space', 'name code roomNumber flatNumber apartmentNumber').populate('tenant', 'name email phone').sort({ billingPeriod: -1, createdAt: -1 }).lean(),
  ]);
  const propertyMedia = await preparePropertyMediaPreviews(media, property._id);
  const nodes = new Map(spaces.map((item) => [String(item._id), { ...item, children: [], media: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    const parentId = node.parent ? String(node.parent) : '';
    if (parentId && nodes.has(parentId)) nodes.get(parentId).children.push(node); else roots.push(node);
  }
  propertyMedia.forEach((item) => { if (item.space && nodes.has(String(item.space))) nodes.get(String(item.space)).media.push(item); });
  res.json({ success: true, data: { property: property.toObject(), tree: roots, propertyMedia, promotions, meterReadings } });
});

// Gallery images belong to a property, so their authenticated preview must be
// authorised through that property rather than through the public marketplace.
// The public route deliberately rejects private properties; this route lets
// the owning landlord preview private media without putting a bearer token in
// an image URL or exposing a public file endpoint.
export const streamPropertyMedia = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.mediaId)) throw new ApiError(404, 'Property media not found');
  const media = await PropertyMedia.findOne({ _id: req.params.mediaId, deletedAt: null }).lean();
  if (!media) throw new ApiError(404, 'Property media not found');
  const property = await propertyForUser(req.user, media.property);
  const file = await resolvePropertyMediaFile(media, property._id);
  if (!file) throw new ApiError(404, 'Property media file is unavailable');
  await sendStoredFile(req, res, file, { download: false });
});

// Prefer an explicit property-scoped media route for gallery previews. The
// media id and property id are checked together, so a stale URL cannot make
// the browser resolve a file from another property. This also gives the
// frontend one canonical URL for every image in the property gallery.
export const streamPropertyMediaForProperty = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.propertyId) || !mongoose.isValidObjectId(req.params.mediaId)) {
    throw new ApiError(404, 'Property media not found');
  }
  const property = await propertyForUser(req.user, req.params.propertyId);
  const media = await PropertyMedia.findOne({ _id: req.params.mediaId, property: property._id, deletedAt: null }).lean();
  if (!media) throw new ApiError(404, 'Property media not found');
  const file = await resolvePropertyMediaFile(media, property._id);
  if (!file) throw new ApiError(404, 'Property media file is unavailable');
  await sendStoredFile(req, res, file, { download: false });
});

// Older property records can still contain the original protected Drive URL in
// Property.images/galleryCover without a PropertyMedia row. Stream those bytes
// through the same owner-authorized property boundary so legacy listings get a
// real thumbnail instead of an <img> request that silently loses the bearer
// token. The file must also be linked to this property; knowing a file ID alone
// is never enough to open it.
export const streamLegacyPropertyImage = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.propertyId) || !mongoose.isValidObjectId(req.params.fileId)) {
    throw new ApiError(404, 'Property image not found');
  }
  const property = await propertyForUser(req.user, req.params.propertyId);
  const fileId = req.params.fileId;
  const file = await DriveFile.findOne({ _id: fileId, status: { $nin: ['trashed', 'quarantined'] } }).select('+storageKey').lean();
  if (!file) throw new ApiError(404, 'Property image file is unavailable');

  const sourcePattern = new RegExp(`/(?:drive/files|files)/${fileId}/content`, 'i');
  const legacyReference = [property.galleryCover, ...(Array.isArray(property.images) ? property.images : [])]
    .some((value) => sourcePattern.test(String(value || '')));
  const relationReference = sameId(file.relations?.property, property._id);
  const documentReference = await Document.exists({ property: property._id, driveFile: fileId });
  if (!legacyReference && !relationReference && !documentReference) throw new ApiError(404, 'Property image not found');

  await sendStoredFile(req, res, file, { download: false });
});

export const getLandlordOverview = asyncHandler(async (req, res) => {
  if (!capabilityRolesForUser(req.user).includes('landlord')) throw new ApiError(403, 'An active Landlord subscription is required');
  const owner = req.user._id; const now = new Date(); const month = now.toISOString().slice(0, 7);
  const usageData = await usageWithLimits(owner);
  const [occupiedRooms, vacantRooms, reservedRooms, applications, interviews, visits, invoices, promotions, activeTenancies, recentUpdates] = await Promise.all([
    RentalUnit.countDocuments({ landlord: owner, availabilityStatus: 'OCCUPIED' }),
    RentalUnit.countDocuments({ landlord: owner, availabilityStatus: { $in: ['AVAILABLE', 'APPLICATION_PENDING'] } }),
    RentalUnit.countDocuments({ landlord: owner, availabilityStatus: { $in: ['RESERVED', 'AGREEMENT_PENDING', 'PAYMENT_PENDING'] } }),
    Application.countDocuments({ status: { $in: ['submitted', 'under_review', 'shortlisted', 'interview_requested', 'interview_scheduled', 'site_visit_scheduled', 'additional_documents_requested'] }, property: { $in: await Property.distinct('_id', { owner }) } }),
    TenantInterview.countDocuments({ landlord: owner, status: { $in: ['requested', 'scheduled', 'rescheduled'] } }),
    PropertyVisit.countDocuments({ landlord: owner, status: { $in: ['requested', 'pending_approval', 'approved', 'rescheduled', 'confirmed'] } }),
    RentalInvoice.find({ landlord: owner, billingMonth: month }).lean(),
    Property.countDocuments({ owner, 'promotion.endsAt': { $gt: now }, $or: [{ 'promotion.featured': true }, { 'promotion.topListing': true }, { 'promotion.urgentType': { $ne: 'none' } }] }),
    Tenancy.countDocuments({ landlord: owner, status: 'active' }),
    Notification.find({ user: owner }).select('title message category actionUrl readAt createdAt').sort({ createdAt: -1 }).limit(5).lean(),
  ]);
  const expected = invoices.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const collected = invoices.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
  const overdue = invoices.filter((item) => item.status === 'overdue').reduce((sum, item) => sum + Number(item.balanceAmount || 0), 0);
  res.json({ success: true, data: { ...usageData, recentUpdates, kpis: { occupiedRooms, vacantRooms, reservedRooms, pendingApplications: applications, activeTenancies, scheduledInterviews: interviews, scheduledSiteVisits: visits, monthlyRentExpected: expected, rentCollected: collected, pendingRent: Math.max(expected - collected, 0), overdueRent: overdue, activePromotions: promotions } } });
});

export const submitTenantKyc = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Tenant account required');
  const body = req.body || {};
  const governmentIdentity = body.governmentIdentity || {};
  const addressProofDetails = body.addressProofDetails || {};
  const passportPhoto = body.passportPhoto || {};
  const requiredValues = [
    governmentIdentity.documentType, governmentIdentity.documentId, governmentIdentity.frontFile,
    addressProofDetails.documentType, addressProofDetails.documentId, addressProofDetails.frontFile, addressProofDetails.backFile,
    passportPhoto.file,
  ];
  if (requiredValues.some((value) => !value)) throw new ApiError(422, 'Government identity, address proof and passport-size photograph are required before dashboard access');
  const normalizedGovernmentIdentity = {
    documentType: governmentIdentity.documentType,
    documentId: governmentIdentity.documentId,
    frontFile: governmentIdentity.frontFile,
    ...(governmentIdentity.backFile ? { backFile: governmentIdentity.backFile } : {}),
  };
  const update = {
    governmentIdentity: normalizedGovernmentIdentity,
    addressProofDetails,
    passportPhoto: { ...passportPhoto, requirementsAccepted: Boolean(passportPhoto.requirementsAccepted ?? true) },
    governmentId: body.governmentId || governmentIdentity.frontFile,
    addressProof: body.addressProof || addressProofDetails.frontFile,
    profilePhoto: body.profilePhoto || passportPhoto.file,
    user: req.user._id,
    status: 'submitted',
    submittedAt: new Date(),
  };
  const record = await TenantKyc.findOneAndUpdate(
    { user: req.user._id },
    {
      $set: update,
      $push: { history: { status: 'submitted', by: req.user._id, at: new Date() } },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await User.findByIdAndUpdate(req.user._id, { kycStatus: 'submitted' });
  res.json({ success: true, data: record });
});

export const reviewTenantKyc = asyncHandler(async (req, res) => {
  if (!['admin', 'manager'].includes(req.user.role)) throw new ApiError(403, 'KYC reviewer access required');
  const status = String(req.body.status || '');
  if (!['changes_required', 'verified', 'rejected', 'suspended', 'expired'].includes(status)) throw new ApiError(422, 'Invalid KYC decision');
  const record = await TenantKyc.findById(req.params.id);
  if (!record) throw new ApiError(404, 'KYC record not found');
  record.status = status; record.reviewer = req.user._id; record.reviewedAt = new Date(); record.reason = req.body.reason;
  if (status === 'verified') { record.verifiedAt = new Date(); record.expiresAt = req.body.expiresAt || new Date(Date.now() + 365 * 86400000); }
  record.history.push({ status, reason: req.body.reason, by: req.user._id, at: new Date() }); await record.save();
  await User.findByIdAndUpdate(record.user, { kycStatus: status });
  res.json({ success: true, data: record });
});

export const streamTenantKycDocument = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.documentId)) throw new ApiError(404, 'KYC document not found');
  const file = await DriveFile.findOne({
    _id: req.params.documentId,
    status: { $nin: ['trashed', 'quarantined'] },
  }).select('+storageKey').lean();
  if (!file) throw new ApiError(404, 'KYC document not found');

  const references = [
    'governmentIdentity.frontFile', 'governmentIdentity.backFile',
    'addressProofDetails.frontFile', 'addressProofDetails.backFile',
    'passportPhoto.file', 'governmentId', 'addressProof', 'profilePhoto', 'selfie', 'employmentProof',
  ];
  const attachedFilter = { $or: references.map((path) => ({ [path]: file._id })) };
  const kyc = await TenantKyc.findOne(attachedFilter).select('user status').lean();
  const legacyKycUpload = await Document.exists({ driveFile: file._id, type: 'tenant_kyc' });
  const recognizedKycFile = TENANT_KYC_DOCUMENT_CATEGORIES.includes(String(file.category || '').toLowerCase());
  const role = String(req.user.role || '').toLowerCase();
  if (role === 'tenant') {
    if (String(file.owner) !== String(req.user._id) || (!kyc && !legacyKycUpload && !recognizedKycFile)) throw new ApiError(403, 'You can only preview your own KYC documents');
  } else if (role === 'manager') {
    const scope = await buildScope(req.user, 'tenant-kyc');
    if (!kyc || !(await TenantKyc.exists({ _id: kyc._id, ...scope }))) throw new ApiError(403, 'This KYC document is outside your assigned tenant scope');
  } else if (role === 'admin') {
    if (!kyc) throw new ApiError(404, 'KYC document is not attached to a submitted record');
  } else {
    throw new ApiError(403, 'KYC document preview access required');
  }

  await sendStoredFile(req, res, file, { download: req.query.download === 'true' });
});

export const createRentalApplication = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Tenant account required');
  const kyc = await TenantKyc.findOne({ user: req.user._id, status: 'verified', $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }, { expiresAt: { $exists: false } }] });
  if (!kyc) throw new ApiError(403, 'Verified KYC is required before applying');
  const property = await Property.findOne({ _id: req.body.property, visibility: 'public', publicationStatus: 'published', status: { $in: ['available', 'partially_occupied', 'occupied', 'reserved', 'rented'] } });
  if (!property) throw new ApiError(404, 'Listing is not available');
  const rentalUnit = req.body.rentalUnit ? await RentalUnit.findOne({ _id: req.body.rentalUnit, property: property._id }) : null;
  if (req.body.rentalUnit && !canAcceptRentalApplication(rentalUnit)) throw new ApiError(404, 'Selected room or unit is not accepting applications');
  const hasRentalUnits = String(property.listingType || property.purpose) === 'rent' && await RentalUnit.exists({ property: property._id, availabilityStatus: { $ne: 'ARCHIVED' } });
  if (hasRentalUnits && !rentalUnit) throw new ApiError(422, 'Choose the specific room or unit you want to rent');
  const space = !rentalUnit && req.body.targetSpace ? await PropertySpace.findOne({ _id: req.body.targetSpace, property: property._id, visibility: 'public', publicationStatus: 'published', status: 'available' }) : null;
  if (req.body.targetSpace && !space) throw new ApiError(404, 'Selected room or unit is not available');
  if (rentalUnit && await Application.exists({ applicant: req.user._id, rentalUnit: rentalUnit._id, status: { $in: OPEN_RENTAL_APPLICATION_STATUSES } })) throw new ApiError(409, 'You already have an active application for this room');
  const rules = rentalUnit ? { maxTotal: rentalUnit.specifications?.maximumOccupants } : (space?.occupancyRules || property.occupancyRules || {}); const summary = req.body.occupantSummary || {};
  const exceeds = (rules.maxTotal && Number(summary.total || 0) > rules.maxTotal) || (rules.maxAdults && Number(summary.adults || 0) > rules.maxAdults) || (rules.maxChildren && Number(summary.children || 0) > rules.maxChildren);
  if (exceeds && !req.body.requestOccupancyException) throw new ApiError(422, 'Occupancy exceeds the landlord limit');
  const application = await Application.create({
    applicationNumber: `AP-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`, applicant: req.user._id, landlord: property.owner, property: property._id, targetSpace: space?._id, rentalUnit: rentalUnit?._id,
    status: 'submitted', step: 9, personal: req.body.personal, employment: req.body.employment, identity: req.body.identity, documents: req.body.documents || [],
    occupantSummary: summary, occupantIds: req.body.occupantIds || [], moveInDate: req.body.moveInDate, expectedStayMonths: req.body.expectedStayMonths,
    monthlyIncome: req.body.monthlyIncome, rentalBudget: req.body.rentalBudget, vehicles: req.body.vehicles || [], pets: req.body.pets || [], references: req.body.references || [], messageToLandlord: req.body.messageToLandlord, submittedAt: new Date(), createdBy: req.user._id, updatedBy: req.user._id,
  });
  if (rentalUnit) await refreshRentalUnitApplicationState(rentalUnit, req.user._id);
  await Property.updateOne({ _id: property._id }, { $inc: { 'metrics.applications': 1 } });
  await createNotification({ user: property.owner, title: 'New tenant application', message: `${req.user.name} applied for ${rentalUnit?.name || space?.name || property.title}`, category: 'system', actionUrl: `/app/applications` });
  res.status(201).json({ success: true, data: application });
});

export const decideApplication = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id).populate('property').populate('rentalUnit');
  if (!application || !canManageProperty(req.user, application.property)) throw new ApiError(403, 'Application decision access denied');
  const status = String(req.body.status || '');
  const allowed = ['under_review', 'shortlisted', 'interview_requested', 'interview_scheduled', 'site_visit_scheduled', 'additional_documents_requested', 'approved', 'rejected', 'waiting_list', 'agreement_pending', 'deposit_pending', 'completed'];
  if (!allowed.includes(status)) throw new ApiError(422, 'Invalid application status');
  assertApplicationDecisionTransition(application, status, req.user, ApiError);
  const decisionUnit = application.rentalUnit ? await RentalUnit.findById(application.rentalUnit._id || application.rentalUnit) : null;
  if (decisionUnit && status === 'approved' && (decisionUnit.currentTenancyId || !['AVAILABLE', 'APPLICATION_PENDING', 'RESERVED'].includes(decisionUnit.availabilityStatus))) {
    throw new ApiError(409, 'This room is already locked by another tenancy workflow');
  }
  application.status = status; application.remarks = req.body.remarks; application.reviewedBy = req.user._id; application.updatedBy = req.user._id;
  if (status === 'approved') { application.acceptedAt = new Date(); application.acceptedBy = req.user._id; }
  if (status === 'rejected') { application.rejectedAt = new Date(); application.rejectionReason = req.body.remarks; }
  await application.save();
  if (application.rentalUnit) {
    const unit = decisionUnit;
    if (unit && status === 'approved') {
      if (unit.availabilityStatus === 'AVAILABLE') await transitionRentalUnit(unit, 'APPLICATION_PENDING', { actorId: req.user._id, reason: 'Application approved' });
      if (unit.availabilityStatus === 'APPLICATION_PENDING') await transitionRentalUnit(unit, 'AGREEMENT_PENDING', { actorId: req.user._id, reason: 'Landlord accepted an applicant' });
      else if (unit.availabilityStatus === 'RESERVED') await transitionRentalUnit(unit, 'AGREEMENT_PENDING', { actorId: req.user._id, reason: 'Landlord accepted an applicant' });
      await Application.updateMany({ _id: { $ne: application._id }, rentalUnit: unit._id, status: { $in: OPEN_RENTAL_APPLICATION_STATUSES } }, { $set: { status: 'waiting_list', closedReason: 'Another application was accepted for this room', updatedBy: req.user._id } });
      await refreshRentalUnitApplicationState(unit, req.user._id);
    } else if (unit && ['rejected', 'waiting_list'].includes(status)) await refreshRentalUnitApplicationState(unit, req.user._id);
  }
  await createNotification({ user: application.applicant, title: 'Application updated', message: `Your application is now ${status.replaceAll('_', ' ')}`, category: 'system', actionUrl: '/app/applications' });
  res.json({ success: true, data: application });
});

export const createTenancyFromApplication = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id).populate('property').populate('rentalUnit');
  if (!application || !canManageProperty(req.user, application.property)) throw new ApiError(403, 'Application access denied');
  if (!['approved', 'agreement_pending', 'deposit_pending'].includes(application.status)) throw new ApiError(409, 'Approve the application before creating a tenancy');
  if (capabilityRolesForUser(req.user).includes('landlord')) await assertLandlordLimit(req.user._id, 'activeTenants');
  const existing = await Tenancy.findOne({ application: application._id });
  if (existing) return res.json({ success: true, data: existing });
  const unit = application.rentalUnit ? await RentalUnit.findOne({ _id: application.rentalUnit._id || application.rentalUnit, property: application.property._id }) : null;
  if (unit && !['AGREEMENT_PENDING', 'RESERVED'].includes(unit.availabilityStatus)) throw new ApiError(409, 'This room is not ready for an agreement');
  const unitPricing = unit?.pricing?.toObject?.() || unit?.pricing || {};
  const tenancy = await Tenancy.create({
    tenancyNumber: `TNC-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`,
    tenant: application.applicant, landlord: application.property.owner, property: application.property._id, space: application.targetSpace,
    rentalUnit: unit?._id, application: application._id, status: unit ? 'agreement_pending' : 'deposit_pending',
    startDate: req.body.startDate || application.moveInDate, endDate: req.body.endDate,
    monthlyRent: req.body.monthlyRent ?? unitPricing.monthlyRent ?? application.property.pricing?.monthlyRent ?? application.property.price,
    securityDeposit: req.body.securityDeposit ?? unitPricing.securityDeposit ?? application.property.pricing?.securityDeposit,
    maintenanceCharge: unitPricing.maintenanceCharge || 0, bookingAmount: unitPricing.bookingAmount || 0, pricingSnapshot: unitPricing,
    dueDay: req.body.dueDay || 1, occupants: application.occupantIds || [],
    statusHistory: [{ to: unit ? 'agreement_pending' : 'deposit_pending', reason: 'Tenancy record created from approved application', changedBy: req.user._id, changedAt: new Date() }],
    createdBy: req.user._id, updatedBy: req.user._id,
  });
  if (unit) { unit.updatedBy = req.user._id; await unit.save({ validateModifiedOnly: true }); await syncPropertyRentalSummary(unit.property, req.user._id); }
  else if (application.targetSpace) await PropertySpace.findByIdAndUpdate(application.targetSpace, { status: 'reserved' }); else await Property.findByIdAndUpdate(application.property._id, { status: 'reserved' });
  application.status = unit ? 'agreement_pending' : 'deposit_pending'; await application.save();
  res.status(201).json({ success: true, data: tenancy });
});

export const calculateUtility = asyncHandler(async (req, res) => {
  const previousReading = Number(req.body.previousReading || 0); const currentReading = Number(req.body.currentReading || 0);
  if (currentReading < previousReading) throw new ApiError(422, 'Current reading cannot be lower than previous reading');
  const unitsConsumed = currentReading - previousReading;
  const totalAmount = unitsConsumed * Number(req.body.ratePerUnit || 0) + Number(req.body.fixedCharge || 0) + Number(req.body.tax || 0) + Number(req.body.otherCharge || 0);
  res.json({ success: true, data: { unitsConsumed, totalAmount } });
});

export const exportProperty = asyncHandler(async (req, res) => {
  const property = await propertyForUser(req.user, req.params.propertyId);
  const [spaces, rentalUnits, applications, visits, tenancies, rentCycles, invoices, utilities] = await Promise.all([
    PropertySpace.find({ property: property._id, deletedAt: null }).lean(), RentalUnit.find({ property: property._id }).lean(),
    Application.find({ property: property._id }).populate('applicant', 'name email phone').lean(), PropertyVisit.find({ property: property._id }).lean(), Tenancy.find({ property: property._id }).populate('tenant', 'name email phone').lean(),
    RentCycle.find({ property: property._id }).lean(),
    RentalInvoice.find({ property: property._id }).lean(), UtilityReading.find({ property: property._id }).lean(),
  ]);
  const payload = { property: property.toObject(), spaces, rentalUnits, applications, visits, tenancies, rentCycles, invoices, utilities, exportedAt: new Date().toISOString() };
  if (req.query.format === 'csv') {
    const rows = rentalUnits.length
      ? rentalUnits.map((unit) => ({ property: property.title, room: unit.roomNumber, status: unit.availabilityStatus, monthlyRent: unit.pricing?.monthlyRent, visibility: unit.visibility, currentTenancyId: unit.currentTenancyId || '' }))
      : spaces.map((space) => ({ property: property.title, space: space.name, level: space.level, status: space.status, purpose: space.purpose, price: space.price, visibility: space.visibility }));
    res.type('text/csv').attachment(`${property.code || property._id}-spaces.csv`).send(toCsv(rows)); return;
  }
  res.attachment(`${property.code || property._id}-backup.json`).json(payload);
});
