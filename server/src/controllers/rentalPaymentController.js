import { DriveFile, Payment, RentalInvoice, Tenancy, User } from '../models/index.js';
import { writeAudit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { applyPaidPayment } from '../services/paymentLifecycle.js';
import { createNotification } from '../services/notifications.js';
import { emitRealtime } from '../services/realtime.js';
import { capabilityRolesForUser } from '../services/rbac.js';
import { ensureRentalInvoicePayment } from '../services/rentalBilling.js';
import { readBuffer } from '../services/storage.js';

const paymentMethods = new Set(['upi', 'card', 'bank_transfer', 'cash', 'cheque', 'gateway', 'offline']);
const sameId = (left, right) => Boolean(left && right && String(left?._id || left) === String(right?._id || right));

function requireRegularTenant(user) {
  if (user?.role !== 'tenant') {
    throw new ApiError(403, 'Only tenant accounts can submit this rental payment.');
  }
}

function requireLandlordOrAdmin(user, payment) {
  if (user?.role === 'admin') return;
  if (!capabilityRolesForUser(user).includes('landlord') || !sameId(payment.payee, user._id)) {
    throw new ApiError(403, 'Only the receiving landlord can review this rental payment.');
  }
}

function cleanText(value, label, maxLength) {
  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value).trim();
  if (text.length > maxLength) throw new ApiError(422, `${label} must be ${maxLength} characters or fewer.`);
  return text || undefined;
}

function openPaymentStatus(invoice, now) {
  return new Date(invoice.dueDate) < now ? 'overdue' : 'pending';
}

function updateInvoicePaymentEntry(invoice, payment, updates) {
  invoice.payments ||= [];
  const index = invoice.payments.findIndex((entry) => sameId(entry?.payment, payment._id));
  const entry = {
    payment: payment._id,
    amount: Number(payment.amount || 0),
    method: payment.method,
    transactionId: payment.transactionId,
    ...updates,
  };
  if (index >= 0) invoice.payments[index].set ? invoice.payments[index].set(entry) : Object.assign(invoice.payments[index], entry);
  else invoice.payments.push(entry);
}

export const submitRentalInvoicePayment = asyncHandler(async (req, res) => {
  requireRegularTenant(req.user);
  const invoice = await RentalInvoice.findOne({ _id: req.params.invoiceId, tenant: req.user._id });
  if (!invoice) throw new ApiError(404, 'Rental invoice not found.');
  if (['paid', 'waived', 'refunded'].includes(invoice.status) || Number(invoice.balanceAmount || 0) <= 0) {
    throw new ApiError(409, 'This rental invoice no longer has an amount due.');
  }
  const tenancy = await Tenancy.findOne({ _id: invoice.tenancy, tenant: req.user._id, landlord: invoice.landlord });
  if (!tenancy) throw new ApiError(403, 'This invoice is not attached to your current tenancy.');

  const now = new Date();
  let payment = await Payment.findOne({ rentalInvoice: invoice._id });
  if (!payment) ({ payment } = await ensureRentalInvoicePayment(invoice, tenancy, now));
  if (!payment) throw new ApiError(409, 'This invoice has no payable balance.');

  const stage = payment.paymentVerification?.status || 'awaiting_tenant';
  if (!['awaiting_tenant', 'rejected'].includes(stage)) {
    throw new ApiError(409, stage === 'approved' ? 'This rental invoice has already been accepted.' : 'Your payment submission is awaiting landlord review.');
  }

  const method = paymentMethods.has(String(req.body.method || '')) ? String(req.body.method) : 'offline';
  const transactionId = cleanText(req.body.transactionId, 'Transaction reference', 120);
  const proofUrl = cleanText(req.body.proofUrl, 'Payment proof URL', 2048);
  const notes = cleanText(req.body.notes, 'Payment note', 2000);
  if (transactionId && await Payment.exists({ _id: { $ne: payment._id }, transactionId })) {
    throw new ApiError(409, 'This transaction reference is already attached to another payment.');
  }

  const previousValue = payment.toObject();
  payment.amount = Math.max(0, Number(invoice.balanceAmount || payment.amount || 0));
  payment.paidAmount = 0;
  payment.status = openPaymentStatus(invoice, now);
  payment.method = method;
  payment.transactionId = transactionId;
  payment.proofUrl = proofUrl;
  payment.notes = notes || payment.notes;
  payment.gateway = { ...(payment.gateway || {}), source: 'rental_invoice', provider: 'manual', approvalRequired: 'landlord', submittedAt: now };
  payment.paymentVerification = {
    ...(payment.paymentVerification?.toObject?.() || payment.paymentVerification || {}),
    status: 'submitted',
    submittedAt: now,
    submittedBy: req.user._id,
    rejectedAt: undefined,
    rejectedBy: undefined,
    rejectionReason: undefined,
    submissionCount: Number(payment.paymentVerification?.submissionCount || 0) + 1,
  };
  payment.updatedBy = req.user._id;
  await payment.save();

  updateInvoicePaymentEntry(invoice, payment, { submittedAt: now, status: 'submitted' });
  invoice.updatedBy = req.user._id;
  await invoice.save({ validateModifiedOnly: true });

  await createNotification({
    user: payment.payee,
    title: 'Rent payment awaiting approval',
    message: `${invoice.invoiceNumber} has a tenant payment submission for ₹${Number(payment.amount || 0).toLocaleString('en-IN')}.`,
    category: 'payment',
    actionUrl: `/app/tenancy_details/${invoice.tenancy}?tab=rent`,
    metadata: { paymentId: payment._id, invoiceId: invoice._id, event: 'rental_payment_submitted' },
  });
  await writeAudit(req, { action: 'rental-payment:submitted', module: 'payments', recordId: payment._id, previousValue, updatedValue: payment.toObject() });
  emitRealtime('payments', 'rental-payment-submitted', payment, { users: [payment.payer, payment.payee] });
  emitRealtime('rental-invoices', 'rental-payment-submitted', invoice, { users: [invoice.tenant, invoice.landlord] });
  res.status(201).json({ success: true, data: payment, message: 'Rent payment submitted for landlord approval.' });
});

export const acceptRentalPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.paymentId, rentalInvoice: { $exists: true } });
  if (!payment) throw new ApiError(404, 'Rental payment not found.');
  requireLandlordOrAdmin(req.user, payment);
  if (payment.paymentVerification?.status !== 'submitted') throw new ApiError(409, 'Only a submitted tenant payment can be accepted.');

  const invoice = await RentalInvoice.findById(payment.rentalInvoice);
  if (!invoice) throw new ApiError(404, 'Linked rental invoice not found.');
  if (['paid', 'waived', 'refunded'].includes(invoice.status) || Number(invoice.balanceAmount || 0) <= 0) {
    throw new ApiError(409, 'The linked rental invoice is already settled.');
  }
  const previousValue = payment.toObject();
  const now = new Date();
  payment.amount = Math.max(0, Number(invoice.balanceAmount || payment.amount || 0));
  payment.paidAmount = payment.amount;
  payment.status = 'paid';
  payment.paidAt = now;
  payment.paymentVerification = {
    ...(payment.paymentVerification?.toObject?.() || payment.paymentVerification || {}),
    status: 'approved', approvedAt: now, approvedBy: req.user._id,
  };
  payment.updatedBy = req.user._id;
  await payment.save();
  await applyPaidPayment(payment, { userId: req.user._id, role: req.user.role, ip: req.ip, device: req.get('user-agent') });
  const roomTenancy = invoice.rentalUnit ? await Tenancy.findOne({ _id: invoice.tenancy, status: 'payment_pending' }).lean() : null;
  if (roomTenancy) await createNotification({
    user: roomTenancy.landlord,
    title: 'Initial room payment verified',
    message: 'Agreement and required initial payment are complete. Verify the room handover and start the rent workflow from My Listings → Tenancy.',
    category: 'payment',
    actionUrl: `/app/my-listings/${roomTenancy.property}/tenancy`,
    metadata: { tenancyId: roomTenancy._id, rentalUnitId: roomTenancy.rentalUnit, readyForOccupancy: true },
  });

  await writeAudit(req, { action: 'rental-payment:accepted', module: 'payments', recordId: payment._id, previousValue, updatedValue: payment.toObject() });
  emitRealtime('payments', 'rental-payment-accepted', payment, { users: [payment.payer, payment.payee] });
  emitRealtime('rental-invoices', 'rental-payment-accepted', { _id: invoice._id }, { users: [invoice.tenant, invoice.landlord] });
  res.json({ success: true, data: payment, message: roomTenancy ? 'Initial payment accepted. Verify the room handover and start the rent workflow.' : 'Rent payment accepted and invoice marked paid.' });
});

export const rejectRentalPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.paymentId, rentalInvoice: { $exists: true } });
  if (!payment) throw new ApiError(404, 'Rental payment not found.');
  requireLandlordOrAdmin(req.user, payment);
  if (payment.paymentVerification?.status !== 'submitted') throw new ApiError(409, 'Only a submitted tenant payment can be rejected.');
  const invoice = await RentalInvoice.findById(payment.rentalInvoice);
  if (!invoice) throw new ApiError(404, 'Linked rental invoice not found.');
  const reason = cleanText(req.body.reason, 'Rejection reason', 1000);
  if (!reason) throw new ApiError(422, 'Provide a rejection reason for the tenant.');

  const previousValue = payment.toObject();
  const now = new Date();
  payment.status = openPaymentStatus(invoice, now);
  payment.paidAmount = 0;
  payment.paidAt = undefined;
  payment.paymentVerification = {
    ...(payment.paymentVerification?.toObject?.() || payment.paymentVerification || {}),
    status: 'rejected', rejectedAt: now, rejectedBy: req.user._id, rejectionReason: reason,
  };
  payment.updatedBy = req.user._id;
  await payment.save();

  updateInvoicePaymentEntry(invoice, payment, { status: 'rejected' });
  invoice.updatedBy = req.user._id;
  await invoice.save({ validateModifiedOnly: true });
  await createNotification({
    user: payment.payer,
    title: 'Rent payment needs attention',
    message: `${invoice.invoiceNumber} was not accepted: ${reason}`,
    category: 'payment',
    actionUrl: `/app/tenancy_details/${invoice.tenancy}?tab=rent`,
    metadata: { paymentId: payment._id, invoiceId: invoice._id, event: 'rental_payment_rejected' },
  });
  await writeAudit(req, { action: 'rental-payment:rejected', module: 'payments', recordId: payment._id, previousValue, updatedValue: payment.toObject() });
  emitRealtime('payments', 'rental-payment-rejected', payment, { users: [payment.payer, payment.payee] });
  emitRealtime('rental-invoices', 'rental-payment-rejected', invoice, { users: [invoice.tenant, invoice.landlord] });
  res.json({ success: true, data: payment, message: 'Rent payment rejected. The tenant can submit a corrected payment.' });
});


export const getRentalPaymentProof = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.paymentId, rentalInvoice: { $exists: true } }).lean();
  if (!payment) throw new ApiError(404, 'Rental payment not found.');

  const participant = sameId(payment.payer, req.user._id) || sameId(payment.payee, req.user._id);
  if (!participant) throw new ApiError(403, 'Only the tenant or receiving landlord can preview this rent payment proof.');

  const explicitFileId = String(payment.proofFile?._id || payment.proofFile || '').trim();
  const proofUrl = String(payment.proofUrl || '');
  const match = proofUrl.match(/\/drive\/files\/([a-f\d]{24})(?:\/content)?(?:[/?#]|$)/i);
  const fileId = explicitFileId || match?.[1] || '';
  if (!fileId) throw new ApiError(404, 'No payment proof is attached to this rent payment.');

  const file = await DriveFile.findOne({ _id: fileId, status: { $ne: 'trashed' } }).select('+storageKey').lean();
  if (!file?.storageKey) throw new ApiError(404, 'Rent payment proof is unavailable.');
  const buffer = await readBuffer(file.storageDriver, file.storageKey);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName || file.name || 'rent-payment-proof')}`);
  res.send(buffer);
});

export const listLandlordTransactions = asyncHandler(async (req, res) => {
  if (String(req.user?.role || '').toLowerCase() === 'admin' || !capabilityRolesForUser(req.user).includes('landlord')) {
    throw new ApiError(403, 'Landlord transaction access required.');
  }

  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(10, Number(req.query.limit || 25)));
  const filter = { payee: req.user._id };
  const type = String(req.query.type || '').trim().toLowerCase();
  const status = String(req.query.status || '').trim().toLowerCase();
  const verificationStatus = String(req.query.verificationStatus || '').trim().toLowerCase();

  if (type && type !== 'all') filter.type = type;
  if (status && status !== 'all') filter.status = status;
  if (verificationStatus && verificationStatus !== 'all') filter['paymentVerification.status'] = verificationStatus;

  const query = String(req.query.q || '').trim();
  if (query) {
    const regex = new RegExp(query.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&'), 'i');
    const payerIds = await User.find({ name: regex }).select('_id').limit(50).lean();
    filter.$or = [
      { invoiceNumber: regex },
      { transactionId: regex },
      { payer: { $in: payerIds.map((item) => item._id) } },
    ];
  }

  const [records, total, summaryRows] = await Promise.all([
    Payment.find(filter)
      .populate('payer', 'name email phone avatar')
      .populate('property', 'title name address')
      .populate('rentalUnit', 'name roomNumber floor floorLabel')
      .populate('tenancy', 'tenancyNumber status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: filter },
      { $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$paidAmount', 0] } },
        paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
        pendingCount: { $sum: { $cond: [{ $eq: ['$paymentVerification.status', 'submitted'] }, 1, 0] } },
        rejectedCount: { $sum: { $cond: [{ $eq: ['$paymentVerification.status', 'rejected'] }, 1, 0] } },
      } },
    ]),
  ]);

  const summary = summaryRows[0] || { totalAmount: 0, totalPaid: 0, paidCount: 0, pendingCount: 0, rejectedCount: 0 };
  res.json({
    success: true,
    data: records,
    summary,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});
