import PDFDocument from 'pdfkit';
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

let receiptFontBuffersPromise;

async function getReceiptOpenSansFonts() {
  if (!receiptFontBuffersPromise) {
    const urls = {
      regular: 'https://unpkg.com/@fontsource/open-sans@5.2.6/files/open-sans-all-400-normal.woff',
      bold: 'https://unpkg.com/@fontsource/open-sans@5.2.6/files/open-sans-all-700-normal.woff',
      extraBold: 'https://unpkg.com/@fontsource/open-sans@5.2.6/files/open-sans-all-800-normal.woff',
    };
    receiptFontBuffersPromise = Promise.all(Object.entries(urls).map(async ([key, url]) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Open Sans font request failed: ${response.status}`);
      return [key, Buffer.from(await response.arrayBuffer())];
    })).then((entries) => Object.fromEntries(entries)).catch(() => null);
  }
  return receiptFontBuffersPromise;
}

async function registerReceiptFonts(doc) {
  const buffers = await getReceiptOpenSansFonts();
  if (buffers) {
    try {
      doc.registerFont('ReceiptOpenSans', buffers.regular);
      doc.registerFont('ReceiptOpenSansBold', buffers.bold);
      doc.registerFont('ReceiptOpenSansExtraBold', buffers.extraBold);
      return {
        regular: 'ReceiptOpenSans',
        bold: 'ReceiptOpenSansBold',
        extraBold: 'ReceiptOpenSansExtraBold',
        openSans: true,
      };
    } catch {
      // PDFKit/fontkit fallback keeps receipt generation available even if
      // the runtime cannot parse a webfont format.
    }
  }
  return { regular: 'Helvetica', bold: 'Helvetica-Bold', extraBold: 'Helvetica-Bold', openSans: false };
}

function receiptBillingMonth(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(value || '-');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function receiptAddressOnly(property) {
  const address = property?.address || {};
  return [
    address.line1 || address.addressLine1 || address.street,
    address.line2 || address.addressLine2,
    address.locality,
    address.city,
    address.district,
    address.state,
    address.country,
    address.postalCode || address.pincode,
  ].map((value) => String(value || '').trim()).filter(Boolean).join(', ') || '-';
}

function receiptFloorLabel(unit) {
  const objectFloor = unit?.floor && typeof unit.floor === 'object'
    ? unit.floor.floorName || unit.floor.name || unit.floor.label || unit.floor.floorNumber
    : '';
  const raw = unit?.floorLabel || objectFloor || unit?.floorNumber || unit?.level || unit?.floor;
  if (raw === undefined || raw === null || raw === '') return '-';
  const text = String(raw);
  if (/^[a-f\d]{24}$/i.test(text)) return '-';
  return /^floor\b/i.test(text) ? text : `Floor ${text}`;
}

function receiptMoney(value) {
  return `INR ${Math.max(0, Number(value || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function receiptDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

function receiptPropertyAddress(property) {
  const address = property?.address || {};
  return [property?.title || property?.name, address.line1, address.line2, address.locality, address.city, address.state, address.postalCode || address.pincode]
    .map((value) => String(value || '').trim()).filter(Boolean).join(', ') || 'Property';
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


export const downloadRentalPaymentReceipt = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.paymentId,
    rentalInvoice: { $exists: true },
    status: 'paid',
    'paymentVerification.status': 'approved',
  })
    .populate('payer', 'name email phone')
    .populate('payee', 'name email phone')
    .populate('property', 'title name address')
    .populate('rentalUnit', 'name roomNumber unitNumber floor floorNumber floorLabel level')
    .populate('tenancy', 'tenancyNumber status')
    .lean();

  if (!payment) throw new ApiError(404, 'Approved rent payment receipt is not available.');
  const participant = sameId(payment.payer, req.user._id) || sameId(payment.payee, req.user._id);
  if (!participant) throw new ApiError(403, 'Only the paying tenant or receiving landlord can download this receipt.');

  const invoice = await RentalInvoice.findById(payment.rentalInvoice).lean();
  if (!invoice) throw new ApiError(404, 'Linked rental invoice not found.');

  const paidAt = payment.paymentVerification?.approvedAt || payment.paidAt || new Date();
  const issuedYear = new Date(paidAt).getFullYear();
  const receiptNumber = `RCP-${issuedYear}-${String(payment._id).slice(-8).toUpperCase()}`;
  const filename = `rent-receipt-${String(invoice.invoiceNumber || receiptNumber).replace(/[^a-z0-9_-]+/gi, '-')}.pdf`;

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: true,
    info: {
      Title: `SecureAsset Rent Payment Receipt ${receiptNumber}`,
      Subject: 'Verified monthly rent payment receipt',
      Author: 'SecureAsset',
      Creator: 'SecureAsset',
      Keywords: 'SecureAsset, rent, payment, receipt, verified',
    },
  });

  const fonts = await registerReceiptFonts(doc);
  const currencyPrefix = fonts.openSans ? '₹' : 'INR ';
  const formatMoney = (value) => `${currencyPrefix}${Math.max(0, Number(value || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const W = doc.page.width;
  const H = doc.page.height;
  const left = 42;
  const width = W - 84;
  const navy = '#0B344B';
  const navy2 = '#0D5470';
  const deep = '#102A43';
  const emerald = '#07836C';
  const emerald2 = '#16A085';
  const greenSoft = '#EAF8F3';
  const blueSoft = '#EEF6FC';
  const pageBg = '#F7FAFC';
  const muted = '#64748B';
  const border = '#DCE7ED';
  const darkText = '#17324A';
  const lightText = '#E6F3F7';
  const white = '#FFFFFF';

  doc.rect(0, 0, W, H).fill(pageBg);

  const font = (weight = 'regular') => {
    const name = weight === 'extraBold' ? fonts.extraBold : weight === 'bold' ? fonts.bold : fonts.regular;
    doc.font(name);
    return doc;
  };

  const safeText = (value) => String(value ?? '-').trim() || '-';
  const drawDivider = (x1, y1, x2, y2, color = border, lineWidth = 0.7) => {
    doc.save().strokeColor(color).lineWidth(lineWidth).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
  };
  const roundedCard = (x, y, w, h, fill = white, stroke = border, radius = 8) => {
    doc.save().roundedRect(x, y, w, h, radius).fillColor(fill).fill();
    if (stroke) doc.roundedRect(x, y, w, h, radius).lineWidth(0.7).strokeColor(stroke).stroke();
    doc.restore();
  };
  const sectionBadge = (x, y, label, color = navy2) => {
    doc.save().roundedRect(x, y, 22, 22, 6).fillColor(color).fill();
    font('bold').fillColor(white).fontSize(8.2).text(label, x, y + 6.2, { width: 22, align: 'center' });
    doc.restore();
  };
  const labelValue = (x, y, label, value, valueWidth = 150, valueSize = 9.2) => {
    font().fillColor(muted).fontSize(7.3).text(label, x, y, { width: 96, ellipsis: true });
    font('bold').fillColor(darkText).fontSize(valueSize).text(safeText(value), x + 96, y - 1.2, { width: valueWidth, ellipsis: true });
  };
  const miniMetric = (x, y, w, label, value, valueColor = darkText, valueSize = 10.3) => {
    font().fillColor(muted).fontSize(6.9).text(label.toUpperCase(), x, y, { width: w, characterSpacing: 0.5 });
    font('bold').fillColor(valueColor).fontSize(valueSize).text(safeText(value), x, y + 17, { width: w, ellipsis: true });
  };

  // Brand header
  const headerY = 28;
  roundedCard(left, headerY, width, 70, white, border, 9);

  // Geometric SecureAsset mark
  const markX = left + 20;
  const markY = headerY + 18;
  doc.save();
  doc.lineWidth(3.1).strokeColor(navy).moveTo(markX, markY + 25).lineTo(markX, markY + 10).lineTo(markX + 15, markY).lineTo(markX + 29, markY + 11).stroke();
  doc.rect(markX + 5, markY + 16, 6, 17).fillColor(navy).fill();
  doc.rect(markX + 15, markY + 12, 6, 21).fillColor(emerald).fill();
  doc.rect(markX + 25, markY + 8, 6, 25).fillColor(emerald2).fill();
  doc.restore();

  font('extraBold').fillColor(navy).fontSize(18.5).text('SECURE', markX + 42, headerY + 18, { continued: true });
  font('extraBold').fillColor(emerald).text('ASSET');
  font().fillColor('#718096').fontSize(7).text('V e r i f i e d   R e n t   P a y m e n t   R e c e i p t', markX + 42, headerY + 45);

  drawDivider(left + 330, headerY + 14, left + 330, headerY + 55, '#D2DEE5');
  font('bold').fillColor('#7A8CA0').fontSize(6.7)
    .text('SAFE PROPERTIES', left + 355, headerY + 14)
    .text('TRUSTED PEOPLE', left + 355, headerY + 27)
    .text('BRIGHTER TOMORROWS', left + 355, headerY + 40);

  // Subtle skyline motif
  doc.save().opacity(0.09).fillColor(navy2);
  const cityBaseX = left + width - 106;
  const cityBaseY = headerY + 65;
  [[0, 24, 14, 20],[18, 13, 18, 31],[40, 5, 20, 39],[64, 17, 18, 27],[86, 28, 12, 16]].forEach(([dx, dy, rw, rh]) => {
    doc.rect(cityBaseX + dx, cityBaseY - rh, rw, rh).fill();
  });
  doc.restore();

  // Hero verification band
  const heroY = 108;
  doc.save();
  doc.roundedRect(left, heroY, width, 88, 10).fillColor(navy2).fill();
  doc.roundedRect(left + 14, heroY + 16, 48, 48, 10).fillColor('#0A6A87').fill();
  doc.strokeColor(white).lineWidth(1.7).roundedRect(left + 28, heroY + 27, 20, 25, 2).stroke();
  doc.moveTo(left + 33, heroY + 34).lineTo(left + 43, heroY + 34).moveTo(left + 33, heroY + 40).lineTo(left + 43, heroY + 40).moveTo(left + 33, heroY + 46).lineTo(left + 41, heroY + 46).stroke();
  doc.restore();

  font('extraBold').fillColor(white).fontSize(18).text('Rent Payment Receipt', left + 76, heroY + 17);
  font('bold').fillColor(lightText).fontSize(9.5).text(`Receipt No: ${receiptNumber}`, left + 76, heroY + 43);
  font().fillColor('#CFE3E9').fontSize(8).text(`Issued: ${receiptDate(paidAt)}`, left + 76, heroY + 61);

  drawDivider(left + 333, heroY + 18, left + 333, heroY + 70, '#4B8799');
  doc.save().roundedRect(left + 354, heroY + 18, 126, 31, 15.5).fillColor('#1FA985').fill();
  doc.circle(left + 374, heroY + 33.5, 9).fillColor('#E8FFF7').fill();
  font('extraBold').fillColor(emerald).fontSize(11).text('✓', left + 368.5, heroY + 26.5, { width: 11, align: 'center' });
  font('extraBold').fillColor(white).fontSize(9.5).text('PAID • VERIFIED', left + 388, heroY + 26.3);
  doc.restore();
  font().fillColor(lightText).fontSize(7.4).text('This payment has been successfully\nprocessed and verified on SecureAsset.', left + 354, heroY + 58, { width: 145, lineGap: 2 });

  // Payment summary
  const summaryY = 206;
  roundedCard(left, summaryY, width, 94, white, border, 8);
  sectionBadge(left + 14, summaryY + 12, '₹');
  font('extraBold').fillColor(navy).fontSize(9.1).text('PAYMENT SUMMARY', left + 45, summaryY + 18);

  const metricY = summaryY + 49;
  miniMetric(left + 26, metricY, 104, 'Amount Paid', formatMoney(payment.paidAmount || payment.amount), emerald, 20);
  drawDivider(left + 142, summaryY + 43, left + 142, summaryY + 82);
  miniMetric(left + 161, metricY, 100, 'Billing Month', receiptBillingMonth(invoice.billingMonth), darkText, 8.8);
  drawDivider(left + 272, summaryY + 43, left + 272, summaryY + 82);
  miniMetric(left + 291, metricY, 102, 'Invoice No.', invoice.invoiceNumber || '-', darkText, 8.6);
  drawDivider(left + 404, summaryY + 43, left + 404, summaryY + 82);
  miniMetric(left + 422, metricY, 92, 'Payment Date', receiptDate(payment.paidAt || paidAt), darkText, 7.7);

  // Tenant + Landlord
  const peopleY = 310;
  const halfW = (width - 10) / 2;
  roundedCard(left, peopleY, halfW, 90, '#F0FAF6', '#DCEDE6', 8);
  roundedCard(left + halfW + 10, peopleY, halfW, 90, '#F1F7FC', '#DBE8F1', 8);

  sectionBadge(left + 14, peopleY + 12, 'T', emerald);
  font('extraBold').fillColor(navy).fontSize(8.8).text('TENANT DETAILS', left + 47, peopleY + 18);
  labelValue(left + 17, peopleY + 46, 'Name', payment.payer?.name || '-', 112, 8.8);
  labelValue(left + 17, peopleY + 61, 'Email', payment.payer?.email || '-', 112, 7.8);
  labelValue(left + 17, peopleY + 76, 'Phone', payment.payer?.phone || '-', 112, 8.2);

  const landlordX = left + halfW + 10;
  sectionBadge(landlordX + 14, peopleY + 12, 'L', navy2);
  font('extraBold').fillColor(navy).fontSize(8.8).text('LANDLORD DETAILS', landlordX + 47, peopleY + 18);
  labelValue(landlordX + 17, peopleY + 46, 'Name', payment.payee?.name || '-', 112, 8.8);
  labelValue(landlordX + 17, peopleY + 61, 'Email', payment.payee?.email || '-', 112, 7.8);
  labelValue(landlordX + 17, peopleY + 76, 'Phone', payment.payee?.phone || '-', 112, 8.2);

  // Property & tenancy
  const propertyY = 410;
  roundedCard(left, propertyY, width, 86, white, border, 8);
  sectionBadge(left + 14, propertyY + 12, 'P');
  font('extraBold').fillColor(navy).fontSize(8.8).text('PROPERTY & TENANCY', left + 47, propertyY + 18);
  drawDivider(left + 306, propertyY + 43, left + 306, propertyY + 75);
  labelValue(left + 18, propertyY + 47, 'Property Name', payment.property?.title || payment.property?.name || '-', 177, 8.1);
  labelValue(left + 18, propertyY + 64, 'Address', receiptAddressOnly(payment.property), 177, 7.2);
  labelValue(left + 324, propertyY + 47, 'Room / Unit', payment.rentalUnit?.name || payment.rentalUnit?.roomNumber || payment.rentalUnit?.unitNumber || '-', 93, 8.1);
  labelValue(left + 324, propertyY + 62, 'Floor', receiptFloorLabel(payment.rentalUnit), 93, 8.1);
  labelValue(left + 324, propertyY + 77, 'Tenancy No.', payment.tenancy?.tenancyNumber || '-', 93, 8.1);

  // Payment details
  const detailY = 506;
  roundedCard(left, detailY, width, 86, white, border, 8);
  sectionBadge(left + 14, detailY + 12, '₹', navy2);
  font('extraBold').fillColor(navy).fontSize(8.8).text('PAYMENT DETAILS', left + 47, detailY + 18);
  drawDivider(left + 306, detailY + 43, left + 306, detailY + 75);
  labelValue(left + 18, detailY + 47, 'Payment Method', String(payment.method || '-').replaceAll('_', ' ').toUpperCase(), 176, 8.1);
  labelValue(left + 18, detailY + 63, 'Transaction ID', payment.transactionId || '-', 176, 8.1);
  font().fillColor(muted).fontSize(7.3).text('Proof Status', left + 18, detailY + 79, { width: 96 });
  doc.save().roundedRect(left + 114, detailY + 73, 120, 20, 10).fillColor(greenSoft).fill();
  font('bold').fillColor(emerald).fontSize(7.2).text(payment.proofFile || payment.proofUrl ? '✓  Submitted & Reviewed' : '✓  Verified', left + 122, detailY + 79, { width: 105, ellipsis: true });
  doc.restore();
  labelValue(left + 324, detailY + 49, 'Approved By', 'Landlord', 93, 8.2);
  labelValue(left + 324, detailY + 67, 'Approval Date', receiptDate(payment.paymentVerification?.approvedAt || payment.paidAt), 93, 7.4);

  // Verification note
  const noteY = 602;
  roundedCard(left, noteY, width, 72, '#EFFAF6', '#D8EFE5', 8);
  sectionBadge(left + 14, noteY + 12, '✓', emerald);
  font('extraBold').fillColor(navy).fontSize(8.8).text('VERIFICATION & NOTES', left + 47, noteY + 18);
  font().fillColor(darkText).fontSize(7.5).text(
    'This is a system-generated rent payment receipt from SecureAsset. The payment has been successfully submitted, reviewed, and verified by the landlord. This receipt serves as a valid confirmation of rent payment for the specified billing month.',
    left + 47,
    noteY + 39,
    { width: width - 66, lineGap: 2.1 },
  );

  // Corporate footer
  const footerY = 684;
  roundedCard(left, footerY, width, 72, white, null, 0);
  drawDivider(left, footerY, left + width, footerY, border);
  drawDivider(left + 170, footerY + 15, left + 170, footerY + 54, border);
  drawDivider(left + 346, footerY + 15, left + 346, footerY + 54, border);

  sectionBadge(left + 8, footerY + 16, 'D', '#EEF6FC');
  font().fillColor(muted).fontSize(6.6).text('Generated On', left + 40, footerY + 16);
  font('bold').fillColor(darkText).fontSize(7.7).text(receiptDate(new Date()), left + 40, footerY + 31, { width: 118 });

  sectionBadge(left + 185, footerY + 16, '@', '#EEF6FC');
  font().fillColor(muted).fontSize(6.6).text('Support', left + 217, footerY + 16);
  font('bold').fillColor(navy2).fontSize(7.5).text('secureasset9@gmail.com', left + 217, footerY + 31, { width: 116 });

  sectionBadge(left + 360, footerY + 16, 'S', '#EEF6FC');
  font('bold').fillColor(darkText).fontSize(7.7).text('SecureAsset Workspace', left + 392, footerY + 15, { width: 120 });
  font().fillColor(muted).fontSize(6.5).text('Manage Properties. Build Trust.', left + 392, footerY + 31, { width: 120 });

  // Premium bottom band with subtle wave
  const bandY = H - 52;
  doc.rect(left, bandY, width, 38).fillColor(navy2).fill();
  doc.save().opacity(0.24).strokeColor(emerald2).lineWidth(1.2);
  doc.moveTo(left + 30, bandY + 32).bezierCurveTo(left + 160, bandY + 5, left + 260, bandY + 45, left + 390, bandY + 17).stroke();
  doc.moveTo(left + 180, bandY + 35).bezierCurveTo(left + 290, bandY + 12, left + 385, bandY + 39, left + 495, bandY + 13).stroke();
  doc.restore();
  font().fillColor('#D9ECF1').fontSize(6.3).text(`© ${new Date().getFullYear()} SecureAsset. All rights reserved.`, left + 18, bandY + 15);
  font('bold').fillColor('#D9ECF1').fontSize(5.8).text('RENT   |   PROPERTIES   |   PEOPLE   |   A BETTER TOMORROW', left + width - 275, bandY + 15, { width: 255, align: 'right', characterSpacing: 0.3 });

  doc.end();
});
