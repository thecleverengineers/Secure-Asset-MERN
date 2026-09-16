import mongoose from 'mongoose';
import { Property, Unit, Tenant, Lease, Survey, Application, Payment, Complaint, Approval, User, AuditLog, Tenancy, AgreementRequest, RentalInvoice } from '../models/index.js';
import { assignedPropertyIds } from '../services/scope.js';
import { getEffectiveRole } from '../services/rbac.js';
import { rentCyclePaymentDueAt } from '../services/rentCycleReminders.js';
import { billingMonthKey, monthlyDueAt, monthlyRentCycleBoundsForBillingMonth } from '../services/rentalBilling.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

export const overview = asyncHandler(async (req, res) => {
  const user = req.user;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const leaseExpiry = new Date(now.getTime() + 60 * 86400000);
  let propertyIds = [];
  const effectiveRole = getEffectiveRole(user);
  const landlordView = effectiveRole === 'landlord';
  const surveyorView = effectiveRole === 'surveyor';
  if (user.role === 'manager') {
    propertyIds = await Property.distinct('_id', { deletedAt: null, $or: [{ manager: user._id }, { _id: { $in: assignedPropertyIds(user) } }] });
  } else if (landlordView) {
    propertyIds = await Property.distinct('_id', { owner: user._id, deletedAt: null });
  } else if (effectiveRole === 'tenant') {
    const [tenancyIds, legacyIds] = await Promise.all([
      // A tenant sees a connected property only after the first party approves
      // the signed agreement and the resulting tenancy becomes active.
      Tenancy.distinct('property', { tenant: user._id, status: { $in: ['active', 'notice', 'move_out'] } }),
      Tenant.distinct('property', { user: user._id, status: { $in: ['active', 'notice'] } }),
    ]);
    propertyIds = [...new Map([...tenancyIds, ...legacyIds].filter(Boolean).map((id) => [String(id), id])).values()];
  }

  const scopedProperty = { $in: propertyIds };
  const propertyFilter = user.role === 'admin' ? {} : { _id: scopedProperty };
  const unitFilter = user.role === 'admin' ? {} : { property: scopedProperty };
  const tenantFilter = user.role === 'admin' ? {} : landlordView || user.role === 'manager' ? { property: scopedProperty } : effectiveRole === 'tenant' ? { user: user._id } : { _id: null };
  const leaseFilter = user.role === 'admin' ? {} : landlordView || user.role === 'manager' ? { property: scopedProperty } : effectiveRole === 'tenant' ? { tenant: user._id } : { _id: null };
  const surveyFilter = user.role === 'admin' ? {} : surveyorView ? { surveyor: user._id } : landlordView || user.role === 'manager' ? { property: scopedProperty } : { _id: null };
  const applicationFilter = user.role === 'admin' ? {} : landlordView ? { landlord: user._id } : user.role === 'manager' ? { property: scopedProperty } : (effectiveRole === 'tenant' || user.role === 'user') ? { applicant: user._id } : { _id: null };
  const paymentFilter = user.role === 'admin' ? {} : landlordView ? { payee: user._id } : user.role === 'manager' ? { property: scopedProperty } : (effectiveRole === 'tenant' || user.role === 'user') ? { payer: user._id } : { _id: null };
  const complaintFilter = user.role === 'admin' ? {} : landlordView || user.role === 'manager' ? { property: scopedProperty } : (effectiveRole === 'tenant' || user.role === 'user') ? { raisedBy: user._id } : { _id: null };
  const approvalFilter = user.role === 'admin' ? {} : landlordView || user.role === 'manager' ? { $or: [{ property: scopedProperty }, { requester: user._id }] } : { requester: user._id };

  const [
    totalProperties, totalUnits, occupiedUnits, totalTenants, activeUsers,
    pendingApplications, pendingSurveys, monthlyRevenueResult, outstandingResult,
    openComplaints, expiringLeases, pendingApprovals,
    surveyGroups, complaintGroups, recentActivities,
  ] = await Promise.all([
    Property.countDocuments(propertyFilter),
    Unit.countDocuments(unitFilter),
    Unit.countDocuments({ ...unitFilter, status: 'occupied' }),
    Tenant.countDocuments({ ...tenantFilter, status: 'active' }),
    user.role === 'admin' ? User.countDocuments({ status: 'active' }) : Promise.resolve(0),
    Application.countDocuments({ ...applicationFilter, status: { $in: ['submitted', 'under_review', 'documents_pending'] } }),
    Survey.countDocuments({ ...surveyFilter, status: { $in: ['assigned', 'in_progress', 'submitted', 'returned', 'overdue'] } }),
    Payment.aggregate([{ $match: { ...paymentFilter, status: 'paid', paidAt: { $gte: monthStart, $lt: monthEnd } } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]),
    Payment.aggregate([{ $match: { ...paymentFilter, status: { $in: ['pending', 'partial', 'overdue'] } } }, { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } }]),
    Complaint.countDocuments({ ...complaintFilter, status: { $nin: ['closed', 'resolved'] } }),
    Lease.countDocuments({ ...leaseFilter, status: { $in: ['active', 'expiring'] }, endDate: { $gte: now, $lte: leaseExpiry } }),
    Approval.countDocuments({ ...approvalFilter, status: 'pending' }),
    Survey.aggregate([{ $match: surveyFilter }, { $group: { _id: '$status', value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
    Complaint.aggregate([{ $match: complaintFilter }, { $group: { _id: '$status', value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
    AuditLog.find(user.role === 'admin' ? {} : { user: user._id }).sort('-createdAt').limit(8).populate('user', 'name role').lean(),
  ]);

  const revenueTrend = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const result = await Payment.aggregate([{ $match: { ...paymentFilter, status: 'paid', paidAt: { $gte: start, $lt: end } } }, { $group: { _id: null, amount: { $sum: '$paidAmount' } } }]);
    revenueTrend.push({ month: start.toLocaleString('en', { month: 'short' }), amount: result[0]?.amount || 0 });
  }

  const roleSpecific = {};
  if (surveyorView) {
    roleSpecific.todayAssignments = await Survey.countDocuments({ surveyor: user._id, deadline: { $gte: new Date(now.toDateString()), $lt: new Date(new Date(now.toDateString()).getTime() + 86400000) } });
    roleSpecific.completedSurveys = await Survey.countDocuments({ surveyor: user._id, status: 'approved' });
  }
  if (['tenant', 'landlord'].includes(effectiveRole)) {
    roleSpecific.nextPayment = await Payment.findOne({ [landlordView ? 'payee' : 'payer']: user._id, status: { $in: ['pending', 'partial', 'overdue'] } }).sort('dueDate').lean();
    if (!landlordView) roleSpecific.activeLease = await Lease.findOne({ tenant: user._id, status: { $in: ['active', 'expiring'] } }).populate('property unit').lean();
    roleSpecific.dashboardMode = landlordView ? 'landlord' : user.activeMode || 'regular';
  }
  if (user.role === 'user') {
    roleSpecific.latestApplication = await Application.findOne({ applicant: user._id }).sort('-createdAt').populate('property').lean();
  }

  res.json({
    success: true,
    data: {
      kpis: { totalProperties, totalUnits, occupiedUnits, vacantUnits: Math.max(totalUnits - occupiedUnits, 0), totalTenants, activeUsers, pendingApplications, pendingSurveys, monthlyRentCollection: monthlyRevenueResult[0]?.total || 0, outstandingDues: outstandingResult[0]?.total || 0, openComplaints, expiringLeases, pendingApprovals },
      occupancyRate: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
      revenueTrend,
      surveyStatus: surveyGroups.map((item) => ({ name: item._id, value: item.value })),
      complaintStatus: complaintGroups.map((item) => ({ name: item._id, value: item.value })),
      recentActivities,
      ...roleSpecific,
    },
  });
});

const tenantPropertyFields = 'title code referenceNumber description status listingType purpose galleryCover images address pricing price isVerified visibility publicationStatus';

function tenantPropertyRecord(record, source, cycleRecord = false) {
  if (!record?.property) return null;
  return {
    id: record._id,
    source,
    cycleId: cycleRecord ? record._id : null,
    property: record.property,
    status: record.status,
    startDate: record.startDate || record.moveInDate,
    endDate: record.endDate || record.moveOutDate,
    monthlyRent: record.monthlyRent,
    securityDeposit: record.securityDeposit,
    leaseNumber: record.leaseNumber,
    paymentCycle: record.paymentCycle,
    paidAt: record.paidAt,
    paidAmount: record.paidAmount,
    space: record.space,
    unit: record.unit,
  };
}

export const myProperties = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'My Property is available to tenant accounts only');

  const tenantId = req.user._id;
  const activeTenancyStatuses = ['active', 'notice', 'move_out'];
  const activeLeaseStatuses = ['pending_approval', 'active', 'expiring', 'renewed'];

  const [tenancies, legacyRentals, leases, salePayments] = await Promise.all([
    Tenancy.find({ tenant: tenantId, status: { $in: activeTenancyStatuses } })
      .sort('-startDate -createdAt')
      .populate('property', tenantPropertyFields)
      .populate('space', 'name code level status')
      .lean(),
    Tenant.find({ user: tenantId, status: { $in: ['active', 'notice'] } })
      .sort('-moveInDate -createdAt')
      .populate('property', tenantPropertyFields)
      .populate('unit', 'unitNumber buildingName floor status')
      .lean(),
    Lease.find({ tenant: tenantId, status: { $in: activeLeaseStatuses } })
      .sort('-startDate -createdAt')
      .populate('property', tenantPropertyFields)
      .populate('unit', 'unitNumber buildingName floor status')
      .lean(),
    Payment.find({ payer: tenantId, type: 'sale', status: 'paid', property: { $ne: null } })
      .sort('-paidAt -createdAt')
      .populate('property', tenantPropertyFields)
      .populate('unit', 'unitNumber buildingName floor status')
      .lean(),
  ]);

  const approvedRentTenancies = tenancies.filter((record) => String(record.property?.purpose || record.property?.listingType || 'rent').toLowerCase() !== 'lease');
  const approvedLeaseTenancies = tenancies.filter((record) => String(record.property?.purpose || record.property?.listingType || '').toLowerCase() === 'lease');
  const rented = [
    ...approvedRentTenancies.map((record) => tenantPropertyRecord(record, 'rented', true)),
    ...legacyRentals.map((record) => tenantPropertyRecord(record, 'rented')),
  ].filter(Boolean);
  const leased = [
    ...approvedLeaseTenancies.map((record) => tenantPropertyRecord(record, 'leased', true)),
    ...leases.map((record) => tenantPropertyRecord(record, 'leased')),
  ].filter(Boolean);
  const purchasedByProperty = new Map();
  salePayments.forEach((record) => {
    const propertyId = String(record.property?._id || record.property || '');
    if (propertyId && !purchasedByProperty.has(propertyId)) purchasedByProperty.set(propertyId, tenantPropertyRecord(record, 'purchased'));
  });
  const purchased = [...purchasedByProperty.values()].filter(Boolean);

  res.json({
    success: true,
    data: {
      rented,
      leased,
      purchased,
      summary: { rented: rented.length, leased: leased.length, purchased: purchased.length, total: rented.length + leased.length + purchased.length },
    },
  });
});

const ACTIVE_TENANCY_CYCLE_STATUSES = ['active', 'notice', 'move_out'];
const DAY = 86_400_000;

function cycleTimeLeft(endsAt, now = new Date()) {
  const end = endsAt ? new Date(endsAt) : null;
  if (!end || Number.isNaN(end.getTime())) return { milliseconds: null, days: null, label: 'Cycle end date is not set', expired: false };
  const milliseconds = end.getTime() - now.getTime();
  if (milliseconds <= 0) return { milliseconds: 0, days: 0, label: 'Cycle has ended', expired: true };
  const days = Math.ceil(milliseconds / DAY);
  return { milliseconds, days, label: days === 1 ? '1 day left' : `${days} days left`, expired: false };
}

function rentInvoicePayload(invoice) {
  if (!invoice) return null;
  return {
    id: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    billingMonth: invoice.billingMonth,
    cycleStartsAt: invoice.cycleStartsAt || null,
    cycleEndsAt: invoice.cycleEndsAt || null,
    dueDate: invoice.dueDate,
    totalAmount: Number(invoice.totalAmount || 0),
    paidAmount: Number(invoice.paidAmount || 0),
    balanceAmount: Number(invoice.balanceAmount ?? invoice.totalAmount ?? 0),
    status: invoice.status,
  };
}

// This endpoint is deliberately tenant-scoped. A tenancy ID copied from a
// different account never reveals a property, agreement, invoice, or signed
// paper because it is matched with the authenticated tenant before any data is
// serialized.
export const myPropertyRentCycle = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Rent cycle details are available to tenant accounts only');
  if (!mongoose.isValidObjectId(req.params.tenancyId)) throw new ApiError(404, 'Rent cycle not found');

  const tenancy = await Tenancy.findOne({
    _id: req.params.tenancyId,
    tenant: req.user._id,
    status: { $in: ACTIVE_TENANCY_CYCLE_STATUSES },
  })
    .populate('property', tenantPropertyFields)
    .populate('space', 'name code level roomNumber flatNumber apartmentNumber')
    .lean();
  if (!tenancy?.property) throw new ApiError(404, 'Active rent cycle not found');

  const now = new Date();
  const activeBillingMonth = billingMonthKey(now);
  const [agreement, invoices] = await Promise.all([
    AgreementRequest.findOne({
      tenant: req.user._id,
      property: tenancy.property._id || tenancy.property,
      agreementType: { $in: ['rent', 'lease'] },
      status: 'approved',
      $or: [
        { tenancy: tenancy._id },
        ...(tenancy.application ? [{ application: tenancy.application }] : []),
      ],
    }).sort({ cycleEndsAt: -1, updatedAt: -1 }).lean(),
    RentalInvoice.find({ tenancy: tenancy._id, tenant: req.user._id }).sort({ dueDate: -1, createdAt: -1 }).limit(12).lean(),
  ]);

  const monthlyInvoice = invoices.find((invoice) => String(invoice.billingMonth || '') === activeBillingMonth) || null;
  // An overdue invoice from an earlier month remains visible in the invoice
  // list, but it must never turn this month’s rent timer into an annual or
  // historical countdown. The calendar month is the rent-cycle authority.
  const currentInvoice = monthlyInvoice;
  const cycleMonth = activeBillingMonth;
  const monthlyCycle = monthlyRentCycleBoundsForBillingMonth(activeBillingMonth, now);
  const cycleStartsAt = monthlyInvoice?.cycleStartsAt || monthlyCycle.startsAt;
  const cycleEndsAt = monthlyInvoice?.cycleEndsAt || monthlyCycle.endsAt;
  const timeLeft = cycleTimeLeft(cycleEndsAt, now);
  const reminderDueAt = rentCyclePaymentDueAt(cycleEndsAt);
  const property = tenancy.property;

  res.json({
    success: true,
    data: {
      tenancy: {
        id: String(tenancy._id),
        status: tenancy.status,
        monthlyRent: Number(tenancy.monthlyRent || 0),
        dueDay: tenancy.dueDay,
        dueTime: tenancy.dueTime,
      },
      property: {
        id: String(property._id),
        title: property.title,
        code: property.code || property.referenceNumber || '',
        galleryCover: property.galleryCover || '',
        images: Array.isArray(property.images) ? property.images : [],
        address: property.address || {},
        space: tenancy.space || null,
      },
      cycle: {
        type: agreement?.agreementType || property.purpose || property.listingType || 'rent',
        startsAt: cycleStartsAt,
        endsAt: cycleEndsAt,
        termMonths: 1,
        billingMonth: cycleMonth,
        nextInvoiceDueAt: monthlyInvoice?.dueDate || monthlyDueAt(monthlyCycle.startsAt, tenancy.dueDay || 1, tenancy.dueTime || '09:00'),
        timeLeft,
        reminder: {
          scheduledFor: cycleEndsAt ? new Date(new Date(cycleEndsAt).getTime() - 7 * DAY) : null,
          dueAt: reminderDueAt,
          status: monthlyInvoice?.rentCycleReminder?.status || 'not_scheduled',
          queuedAt: monthlyInvoice?.rentCycleReminder?.queuedAt || null,
        },
      },
      agreement: agreement ? {
        id: String(agreement._id),
        title: agreement.renderedTitle || `${agreement.agreementType === 'lease' ? 'Lease' : 'Rent'} agreement`,
        agreementType: agreement.agreementType,
        status: agreement.status,
        firstPartyApprovalAt: agreement.firstPartyApprovalAt || null,
        secondPartySignedAt: agreement.secondPartySignedAt || null,
        cycleStartedAt: agreement.cycleStartedAt || tenancy.startDate || null,
        cycleEndsAt: agreement.cycleEndsAt || tenancy.endDate || null,
        nextDueAt: agreement.nextDueAt || null,
        renewalRequestedAt: agreement.renewalRequestedAt || null,
        cancellationState: agreement.cancellationResolution || 'none',
        previewAvailable: true,
      } : null,
      currentInvoice: rentInvoicePayload(currentInvoice),
      invoices: invoices.map(rentInvoicePayload),
    },
  });
});
