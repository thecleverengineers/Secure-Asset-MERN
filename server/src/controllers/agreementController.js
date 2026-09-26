import crypto from 'node:crypto';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import { fileTypeFromBuffer } from 'file-type';
import {
  AgreementRequest, AgreementTemplate, Application, DriveFile, DriveFileVersion, Payment, Property, PropertySpace, RentalUnit, Tenancy, User,
} from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { createNotification } from '../services/notifications.js';
import { capabilityRolesForUser } from '../services/rbac.js';
import { writeAudit } from '../middleware/audit.js';
import { isApplicationAccepted, sameId } from '../services/applicationWorkflow.js';
import { buildStorageKey, readBuffer, saveBuffer } from '../services/storage.js';
import { assertStorageAvailable, changeUsage, logDriveActivity } from '../services/driveService.js';
import { assertLandlordLimit } from '../services/landlordSubscription.js';
import { ensureInitialRentalInvoice, monthlyDueAt } from '../services/rentalBilling.js';
import { syncPropertyRentalSummary, transitionRentalUnitToPaymentPending } from '../services/rentalUnitLifecycle.js';
import { addCalendarMonthsClamped, formatAgreementDate, parseAgreementDate } from '../utils/agreementDates.js';

const AGREEMENT_TYPES = new Set(['rent', 'lease', 'sale']);
const REQUEST_ACCESS_STATUSES = new Set([
  'draft', 'first_party_signed', 'configuration_required', 'sent', 'viewed',
  'awaiting_first_party_approval', 'approved', 'signed', 'cancelled', 'closed', 'declined', 'voided', 'expired',
]);
const TENANT_VISIBLE_REQUEST_STATUSES = new Set([
  'sent', 'viewed', 'awaiting_first_party_approval', 'approved', 'signed', 'cancelled', 'closed', 'declined', 'voided', 'expired',
]);
const FIRST_PARTY_MARK_TYPES = new Set(['signature', 'stamp_seal']);
const INTERNAL_MARK_MIME = 'image/png';
const MAX_MARK_BYTES = 5 * 1024 * 1024;
const MAX_DEPOSIT_PROOF_BYTES = 8 * 1024 * 1024;
const DEPOSIT_PROOF_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
const ACTIVE_CYCLE_AGREEMENT_TYPES = new Set(['rent', 'lease']);
const CYCLE_TERMINAL_STATUSES = new Set(['cancelled', 'closed', 'declined', 'voided', 'expired']);

const DEFAULT_TEMPLATES = {
  rent: {
    name: 'Standard Rent Agreement',
    title: 'Residential Rent Agreement',
    body: `This Rent Agreement is made on {{agreement_date}} between {{landlord_name}} (First Party / Property Owner) and {{tenant_name}} (Second Party / Applicant Tenant) for {{property_title}} at {{property_address}}.

The Tenant agrees to occupy {{space_name}} for {{duration_months}} months from {{start_date}} to {{end_date}}, for a monthly rent of {{amount}} and a security deposit of {{security_deposit}}. Rent remains payable monthly on the agreed due day. The premises shall be used only for lawful residential purposes. The Tenant shall keep the premises in reasonable condition and pay all agreed charges on time.

The parties agree to the terms recorded in this stamp-paper document and any lawful schedule attached to it.`,
  },
  lease: {
    name: 'Standard Lease Agreement',
    title: 'Property Lease Agreement',
    body: `This Lease Agreement is made on {{agreement_date}} between {{landlord_name}} (First Party / Property Owner) and {{tenant_name}} (Second Party / Applicant Tenant) for {{property_title}} at {{property_address}}.

The lease consideration is {{amount}} for a term of {{duration_months}} months from {{start_date}} to {{end_date}}. The Lessee may use {{space_name}} only for the approved purpose and shall comply with all property rules, maintenance obligations and monthly payment dates.

The parties agree to the terms recorded in this stamp-paper document and any lawful schedule attached to it.`,
  },
  sale: {
    name: 'Standard Sale Agreement',
    title: 'Property Sale Agreement',
    body: `This Sale Agreement is made on {{agreement_date}} between {{landlord_name}} (First Party / Property Owner) and {{tenant_name}} (Second Party / Applicant Tenant) for {{property_title}} at {{property_address}}.

The agreed sale consideration is {{amount}}. The parties will complete lawful verification, payment, registration and handover steps according to the final transaction schedule. {{space_name}} is included only to the extent described in the property records.

The parties agree to the terms recorded in this stamp-paper document and any lawful schedule attached to it.`,
  },
};

function isAgreementManager(user) {
  return String(user?.role || '').toLowerCase() === 'admin' || capabilityRolesForUser(user).includes('landlord');
}

function normalizeType(value) {
  const type = String(value || '').trim().toLowerCase();
  return AGREEMENT_TYPES.has(type) ? type : 'rent';
}

function templateKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70);
}

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeStampPaper(value = {}) {
  const denomination = Number(value.denomination || 0);
  const requestedCertificateSpace = Number(value.certificateSpaceMm ?? 70);
  const certificateSpaceMm = Number.isFinite(requestedCertificateSpace)
    ? Math.min(95, Math.max(55, requestedCertificateSpace))
    : 70;
  return {
    enabled: value.enabled !== false,
    format: 'e_stamp',
    state: cleanText(value.state),
    denomination: Number.isFinite(denomination) && denomination >= 0 ? denomination : 0,
    series: cleanText(value.series),
    certificateSpaceMm,
    // Modern e-Stamps used by Secure Asset are always laid out on standard A4.
    paperSize: 'A4',
  };
}

function addressText(property) {
  const address = property?.address || {};
  return [address.line1, address.line2, address.locality, address.landmark, address.city, address.state, address.country, address.postalCode]
    .map((value) => cleanText(value)).filter(Boolean).join(', ') || 'Address recorded in property details';
}

function formatMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 'As agreed by the parties';
  return `INR ${number.toLocaleString('en-IN')}`;
}

function agreementAmount(property, type, rentalUnit) {
  const pricing = property?.pricing || {};
  if (type === 'sale') return pricing.salePrice ?? property.price;
  if (type === 'lease') return pricing.leaseAmount ?? property.price;
  return rentalUnit?.pricing?.monthlyRent ?? pricing.monthlyRent ?? property.price;
}

function applicationSpaceName(application) {
  const rentalUnit = application?.rentalUnit;
  if (rentalUnit) return cleanText(rentalUnit?.name || rentalUnit?.roomNumber, 'the selected rental room');
  const space = application?.targetSpace;
  return cleanText(space?.name || space?.roomNumber || space?.flatNumber || space?.apartmentNumber, 'the selected property space');
}

function renderTemplate(template, data) {
  return String(template || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key) => cleanText(data[String(key).toLowerCase()]));
}

function markFileId(mark) {
  return mark?.file?._id || mark?.file || null;
}

function hasMark(mark) {
  return Boolean(markFileId(mark) && mongoose.isValidObjectId(markFileId(mark)));
}

function isTransparentPng(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length > 25
    && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && [4, 6].includes(buffer[25]);
}

async function readPartyMark(mark) {
  const fileId = markFileId(mark);
  if (!mongoose.isValidObjectId(fileId)) return null;
  const file = await DriveFile.findOne({ _id: fileId, status: { $ne: 'trashed' } }).select('+storageKey');
  if (!file || file.mimeType !== INTERNAL_MARK_MIME || !file.storageKey) return null;
  try {
    const buffer = await readBuffer(file.storageDriver, file.storageKey);
    return isTransparentPng(buffer) ? { buffer, mark } : null;
  } catch {
    return null;
  }
}

function drawPartyMark(document, { title, name, mark, x, y, width = 485 }) {
  const height = 126;
  document.roundedRect(x, y, width, height, 8).lineWidth(1).strokeColor('#CBD5E1').stroke();
  document.fillColor('#0F172A').font('Times-Bold').fontSize(10).text(title, x + 14, y + 13, { width: width - 28 });
  document.fillColor('#475569').font('Times-Roman').fontSize(9).text(name || '—', x + 14, y + 30, { width: width - 28 });
  const descriptor = mark?.mark?.kind === 'stamp_seal' ? 'Stamp / seal' : 'Signature';
  if (mark?.buffer) {
    try {
      document.image(mark.buffer, x + 14, y + 50, { fit: [width - 28, 52], align: 'center', valign: 'center' });
      document.fillColor('#64748B').font('Times-Roman').fontSize(8).text(`${descriptor} · background removed automatically`, x + 14, y + 108, { width: width - 28, align: 'right' });
      return;
    } catch {
      // A malformed historic image must never prevent an authorised party from
      // opening the agreement preview. The missing mark is shown below.
    }
  }
  document.fillColor('#94A3B8').font('Times-Italic').fontSize(9).text(`${descriptor} not yet uploaded`, x + 14, y + 75, { width: width - 28, align: 'center' });
}

async function createStampPaperPdf({ title, body, stampPaper, agreementType, landlordName, tenantName, firstPartyMark, secondPartySignature, approvalStatus, approvedAt, durationMonths, startDate, endDate, cycleStartedAt, cycleEndsAt }) {
  const [firstMark, secondMark] = await Promise.all([readPartyMark(firstPartyMark), readPartyMark(secondPartySignature)]);
  return new Promise((resolve, reject) => {
    const chunks = [];
    // Modern e-Stamp certificates are issued outside Secure Asset and are
    // printed on A4. Leave the first-page certificate/header zone completely
    // blank, then start the agreement below it with a 1.25-inch working margin.
    const legalMargin = 90;
    const eStampCertificateSpaceMm = Math.min(95, Math.max(55, Number(stampPaper.certificateSpaceMm || 70)));
    const millimetresToPoints = 72 / 25.4;
    const firstPageTopClearance = legalMargin + (eStampCertificateSpaceMm * millimetresToPoints);
    const bodyFontSize = 11;
    const oneAndHalfLineGap = 5.5;

    const document = new PDFDocument({
      size: 'A4',
      margin: legalMargin,
      info: { Title: title, Author: 'SecureAsset' },
    });
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));

    // PDFKit's standard Times family provides the formal Times New Roman-style
    // legal appearance without relying on an external font file at runtime.
    // Nothing is drawn above firstPageTopClearance: that pure-white area is
    // reserved for the official e-Stamp certificate/header and serial data.
    document.y = firstPageTopClearance;
    document.fillColor('#334155').font('Times-Bold').fontSize(9).text('SECURE ASSET', {
      align: 'center',
      characterSpacing: 1.4,
      lineGap: 2,
    });
    document.moveDown(.35).fillColor('#111827').font('Times-Bold').fontSize(15).text(title, {
      align: 'center',
      lineGap: 2,
    });
    const titleRuleY = document.y + 8;
    document.moveTo(legalMargin, titleRuleY)
      .lineTo(document.page.width - legalMargin, titleRuleY)
      .lineWidth(.6)
      .strokeColor('#CBD5E1')
      .stroke();
    document.y = titleRuleY + 12;

    document.fillColor('#111827').font('Times-Roman').fontSize(bodyFontSize);
    // 11pt body + 5.5pt gap approximates 1.5-line legal-document spacing.
    // Justification keeps both edges clean and gives the agreement a formal,
    // uniform legal-document appearance.
    document.text(body, {
      align: 'justify',
      lineGap: oneAndHalfLineGap,
      paragraphGap: 8,
    });

    document.moveDown(1.25).font('Times-Bold').fontSize(10.5).text('Parties', { lineGap: 2 });
    document.font('Times-Roman').fontSize(10).text(
      `First party (landlord-enabled tenant): ${landlordName || '____________________________'}`,
      { lineGap: 5 },
    );
    document.text(
      `Second party (applicant tenant): ${tenantName || '____________________________'}`,
      { lineGap: 5 },
    );
    document.moveDown(.45).font('Times-Roman').fontSize(9).fillColor('#475569');
    document.text(approvedAt
      ? `First-party verification and approval: ${new Date(approvedAt).toLocaleString('en-IN')}`
      : 'First-party verification and approval: pending', { lineGap: 4 });

    const termStart = startDate || cycleStartedAt;
    const termEnd = endDate || cycleEndsAt;
    if (Number(durationMonths || 0) > 0) {
      document.text(`Agreement term: ${Number(durationMonths)} month${Number(durationMonths) === 1 ? '' : 's'}`, { lineGap: 4 });
    }
    if (termStart || termEnd) {
      document.text(`Agreement dates: ${termStart ? formatAgreementDate(termStart) : '—'} to ${termEnd ? formatAgreementDate(termEnd) : '—'}`, { lineGap: 4 });
      if (['rent', 'lease'].includes(agreementType)) {
        document.text('Rent payment cycle: monthly, regardless of the agreement term.', { lineGap: 4 });
      }
    }

    document.addPage({ margin: legalMargin });
    document.y = firstPageTopClearance;
    document.fillColor('#111827').font('Times-Bold').fontSize(15).text('SIGNATURES / STAMP SEAL', {
      align: 'center',
      lineGap: 2,
    });
    document.moveDown(.5).fillColor('#64748B').font('Times-Roman').fontSize(9).text(
      'Each mark is stored privately in SecureAsset and embedded in this agreement preview.',
      { align: 'center', lineGap: 3 },
    );

    const signatureX = legalMargin;
    const signatureWidth = document.page.width - (legalMargin * 2);
    drawPartyMark(document, {
      title: 'FIRST PARTY · LANDLORD-ENABLED TENANT',
      name: landlordName,
      mark: firstMark,
      x: signatureX,
      y: 190,
      width: signatureWidth,
    });
    drawPartyMark(document, {
      title: 'SECOND PARTY · APPLICANT TENANT',
      name: tenantName,
      mark: secondMark,
      x: signatureX,
      y: 344,
      width: signatureWidth,
    });

    document.end();
  });
}

async function ensureDefaultTemplates(ownerId) {
  const existing = await AgreementTemplate.find({ owner: ownerId, agreementType: { $in: [...AGREEMENT_TYPES] } }).lean();
  const existingTypes = new Set(existing.map((item) => item.agreementType));
  for (const type of AGREEMENT_TYPES) {
    if (existingTypes.has(type)) continue;
    const defaults = DEFAULT_TEMPLATES[type];
    try {
      await AgreementTemplate.create({
        owner: ownerId, key: `default-${type}`, agreementType: type, name: defaults.name, title: defaults.title,
        body: defaults.body, stampPaper: { enabled: true, format: 'e_stamp', paperSize: 'A4', certificateSpaceMm: 70 }, active: true, version: 1,
        createdBy: ownerId, updatedBy: ownerId,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
}

async function loadApplication(applicationId) {
  if (!mongoose.isValidObjectId(applicationId)) throw new ApiError(404, 'Application not found');
  const application = await Application.findById(applicationId)
    .populate('property')
    .populate('targetSpace')
    .populate('rentalUnit')
    .populate('applicant', 'name email phone')
    .populate('landlord', 'name email phone');
  if (!application || !application.property) throw new ApiError(404, 'Application not found');
  return application;
}

async function requestForParticipant(id, user) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Agreement request not found');
  const request = await AgreementRequest.findById(id).populate('application property space rentalUnit template landlord tenant securityDepositPayment');
  if (!request) throw new ApiError(404, 'Agreement request not found');
  const administrator = String(user?.role || '').toLowerCase() === 'admin';
  const firstParty = sameId(request.landlord, user?._id);
  const secondParty = sameId(request.tenant, user?._id);
  if (!administrator && !firstParty && !secondParty) {
    throw new ApiError(403, 'Agreement access denied');
  }
  if (!administrator && secondParty && !firstParty && !TENANT_VISIBLE_REQUEST_STATUSES.has(request.status)) {
    throw new ApiError(403, 'The first party has not sent this agreement to you yet');
  }
  if (!REQUEST_ACCESS_STATUSES.has(request.status)) throw new ApiError(409, 'Agreement request is no longer available');
  return request;
}

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function cycleTermMonths(request) {
  const stored = Number(request?.durationMonths || request?.cycleTermMonths || 0);
  if (Number.isInteger(stored) && stored >= 1) return stored;
  const requested = Number(request?.application?.expectedStayMonths || 0);
  if (Number.isInteger(requested) && requested >= 1) return requested;
  return request?.agreementType === 'lease' ? 12 : 1;
}

function cycleDueDay(application, startedAt) {
  const moveIn = validDate(application?.moveInDate);
  return Math.min(31, Math.max(1, Number(moveIn?.getDate?.() || startedAt.getDate() || 1)));
}

function nextMonthlyDueAt(now, dueDay = 1, dueTime = '09:00') {
  const currentMonth = monthlyDueAt(now, dueDay, dueTime);
  if (currentMonth.getTime() > now.getTime()) return currentMonth;
  return monthlyDueAt(new Date(now.getFullYear(), now.getMonth() + 1, 1), dueDay, dueTime);
}

function isLegacyAwaitingApproval(request) {
  return request?.provider === 'internal_signature'
    && request?.status === 'signed'
    && !request?.firstPartyApprovalAt;
}

function visibleRequestStatus(request) {
  return isLegacyAwaitingApproval(request) ? 'awaiting_first_party_approval' : String(request?.status || 'draft');
}

function cycleTimeLeft(endDate, now = new Date()) {
  const end = validDate(endDate);
  if (!end) return { days: null, label: 'End date not set', expired: false };
  const milliseconds = end.getTime() - now.getTime();
  const days = Math.max(0, Math.ceil(milliseconds / 86_400_000));
  if (milliseconds <= 0) return { days: 0, label: 'Cycle has ended', expired: true };
  return { days, label: days === 1 ? '1 day left' : `${days} days left`, expired: false };
}

function agreementLifecycle(request, tenancy, now = new Date()) {
  const status = visibleRequestStatus(request);
  const type = normalizeType(request?.agreementType);
  const isCycle = ACTIVE_CYCLE_AGREEMENT_TYPES.has(type);
  const startsAt = validDate(request?.cycleStartedAt || tenancy?.startDate);
  const endsAt = validDate(request?.cycleEndsAt || tenancy?.endDate);
  const active = isCycle && status === 'approved' && !CYCLE_TERMINAL_STATUSES.has(status)
    && (!request?.rentalUnit || tenancy?.status === 'active');
  const dueAt = active && tenancy
    ? nextMonthlyDueAt(now, tenancy.dueDay || 1, tenancy.dueTime || '09:00')
    : validDate(request?.nextDueAt);
  const timeLeft = cycleTimeLeft(endsAt, now);
  const cancellationState = request?.cancellationResolution === 'requested'
    ? 'requested'
    : request?.cancellationResolution === 'rejected'
      ? 'rejected'
      : status === 'cancelled'
        ? 'cancelled'
        : 'none';
  return {
    enabled: isCycle,
    active,
    current: tenancy?.agreement ? String(tenancy.agreement?._id || tenancy.agreement) === String(request?._id || '') : true,
    tenancyId: String(tenancy?._id || request?.tenancy?._id || request?.tenancy || ''),
    startsAt,
    endsAt,
    nextDueAt: dueAt,
    termMonths: cycleTermMonths(request),
    timeLeftDays: timeLeft.days,
    timeLeftLabel: timeLeft.label,
    expired: timeLeft.expired,
    renewal: {
      available: active,
      requested: Boolean(request?.renewalRequestedAt),
      requestedAt: request?.renewalRequestedAt || null,
      requestedBy: request?.renewalRequestedBy?._id || request?.renewalRequestedBy || null,
      count: Array.isArray(request?.renewalHistory) ? request.renewalHistory.length : 0,
    },
    cancellation: {
      state: cancellationState,
      requestedAt: request?.cancellationRequestedAt || null,
      requestedBy: request?.cancellationRequestedBy?._id || request?.cancellationRequestedBy || null,
      reason: request?.cancellationReason || '',
    },
  };
}

function requestPayload(request, tenancy, now = new Date()) {
  const data = request?.toObject ? request.toObject() : { ...request };
  data.status = visibleRequestStatus(data);
  data.lifecycle = agreementLifecycle(data, tenancy, now);

  const amount = securityDepositAmount(data);
  const payment = data.securityDepositPayment && data.securityDepositPayment.paymentVerification
    ? data.securityDepositPayment
    : null;
  data.securityDeposit = {
    required: amount > 0,
    amount,
    status: amount > 0 ? (payment?.paymentVerification?.status || 'awaiting_tenant') : 'not_required',
    payment,
  };
  return data;
}

function securityDepositAmount(request) {
  if (!ACTIVE_CYCLE_AGREEMENT_TYPES.has(normalizeType(request?.agreementType)) || request?.renewalOf) return 0;
  const raw = request?.rentalUnit?.pricing?.securityDeposit ?? request?.property?.pricing?.securityDeposit ?? 0;
  const amount = Number(raw || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function depositVerificationStatus(payment) {
  return String(payment?.paymentVerification?.status || (payment ? 'awaiting_tenant' : 'not_required'));
}

async function ensureSecurityDepositPayment(request, actorId) {
  const amount = securityDepositAmount(request);
  if (amount <= 0) return null;

  const applicationId = request?.application?._id || request?.application;
  const payer = request?.tenant?._id || request?.tenant;
  const payee = request?.landlord?._id || request?.landlord;
  let payment = null;

  const linkedId = request?.securityDepositPayment?._id || request?.securityDepositPayment;
  if (mongoose.isValidObjectId(linkedId)) payment = await Payment.findById(linkedId);

  if (!payment && mongoose.isValidObjectId(applicationId)) {
    payment = await Payment.findOne({
      application: applicationId,
      type: 'deposit',
      payer,
      payee,
      status: { $nin: ['cancelled', 'refunded'] },
    }).sort({ createdAt: -1 });
  }

  if (!payment) {
    payment = await Payment.create({
      invoiceNumber: `DEP-${String(request._id).slice(-8).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      payer,
      payee,
      property: request?.property?._id || request?.property,
      rentalUnit: request?.rentalUnit?._id || request?.rentalUnit,
      application: applicationId,
      type: 'deposit',
      amount,
      paidAmount: 0,
      status: 'pending',
      method: 'bank_transfer',
      gateway: { source: 'security_deposit', agreementRequest: String(request._id), approvalRequired: 'landlord' },
      paymentVerification: { status: 'awaiting_tenant', submissionCount: 0 },
      createdBy: actorId,
      updatedBy: actorId,
    });
  } else if (Number(payment.amount || 0) !== amount && depositVerificationStatus(payment) !== 'approved') {
    payment.amount = amount;
    payment.updatedBy = actorId;
    await payment.save();
  }

  request.securityDepositPayment = payment._id;
  return payment;
}

async function persistSecurityDepositProof(req, request) {
  if (!req.file?.buffer?.length) throw new ApiError(422, 'Upload the security deposit payment proof');
  if (Number(req.file.size || req.file.buffer.length) > MAX_DEPOSIT_PROOF_BYTES) {
    throw new ApiError(413, 'Payment proof must be 8 MB or smaller');
  }

  const detected = await fileTypeFromBuffer(req.file.buffer);
  const mimeType = String(detected?.mime || '').toLowerCase();
  if (!DEPOSIT_PROOF_MIME_TYPES.has(mimeType)) {
    throw new ApiError(422, 'Payment proof must be a PNG, JPEG, WebP or PDF file');
  }

  await assertStorageAvailable(req.user._id, req.file.size);
  const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const extension = `.${detected.ext === 'jpg' ? 'jpg' : detected.ext}`;
  const filename = `security-deposit-${String(request._id).slice(-8)}-${Date.now()}${extension}`;
  const category = mimeType.startsWith('image/') ? 'image' : 'document';
  const storageKey = buildStorageKey(req.user._id, filename, 'security-deposit-payments');
  const stored = await saveBuffer(req.file.buffer, storageKey, mimeType);

  const driveFile = await DriveFile.create({
    owner: req.user._id,
    name: filename,
    originalName: req.file.originalname || filename,
    description: `Security deposit payment proof for agreement ${request._id}`,
    extension,
    mimeType,
    category,
    documentType: 'security_deposit_payment_proof',
    storageDriver: stored.driver,
    storageKey: stored.key,
    sizeBytes: req.file.size,
    checksum,
    visibility: 'private',
    confidentiality: 'financial_document',
    immutable: true,
    tags: ['security-deposit', 'payment-proof', 'agreement'],
    relations: { property: request.property?._id || request.property, user: req.user._id },
    legalMetadata: {
      documentType: 'security_deposit_payment_proof',
      verificationStatus: 'submitted',
      relatedParties: [String(request.landlord?._id || request.landlord), String(request.tenant?._id || request.tenant)],
    },
    preview: { status: 'ready' },
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await DriveFileVersion.create({
    file: driveFile._id,
    owner: req.user._id,
    version: 1,
    storageDriver: stored.driver,
    storageKey: stored.key,
    sizeBytes: req.file.size,
    checksum,
    mimeType,
    changeDescription: 'Uploaded security deposit payment proof',
    approvalStatus: 'submitted',
    immutable: true,
    uploadedBy: req.user._id,
  });

  await changeUsage(req.user._id, req.file.size, category);
  await logDriveActivity(req, driveFile, 'file_uploaded', {
    agreementRequest: request._id,
    purpose: 'security_deposit_payment_proof',
  });
  return driveFile;
}

async function tenancyForAgreement(request) {
  const tenancyId = request?.tenancy?._id || request?.tenancy;
  if (mongoose.isValidObjectId(tenancyId)) return Tenancy.findById(tenancyId);
  const applicationId = request?.application?._id || request?.application;
  if (!mongoose.isValidObjectId(applicationId)) return null;
  return Tenancy.findOne({ application: applicationId }).sort({ createdAt: -1 });
}

function assertFirstParty(request, user, message = 'Only the landlord-enabled first party can perform this agreement action') {
  if (!isAgreementManager(user) || !sameId(request.landlord, user?._id)) throw new ApiError(403, message);
}

function assertSecurityDepositLandlord(request, user, message = 'Only the receiving landlord can verify or reject this security deposit payment') {
  if (String(user?.role || '').toLowerCase() === 'admin'
    || !capabilityRolesForUser(user).includes('landlord')
    || !sameId(request.landlord, user?._id)) {
    throw new ApiError(403, message);
  }
}

async function markCyclePropertyOccupied(request, actorId) {
  const occupiedStatus = request.agreementType === 'lease' ? 'leased' : 'rented';
  const propertyId = request.property?._id || request.property;
  const spaceId = request.space?._id || request.space;
  if (mongoose.isValidObjectId(spaceId)) {
    await PropertySpace.updateOne({ _id: spaceId, property: propertyId, deletedAt: null }, { $set: { status: occupiedStatus, updatedBy: actorId } });
    return;
  }
  if (mongoose.isValidObjectId(propertyId)) {
    await Property.updateOne({ _id: propertyId, deletedAt: null }, { $set: { status: occupiedStatus, updatedBy: actorId } });
  }
}

async function releaseCycleProperty(request, actorId) {
  const propertyId = request.property?._id || request.property;
  const spaceId = request.space?._id || request.space;
  const occupiedTenancyStatuses = ['active', 'notice', 'move_out'];

  if (mongoose.isValidObjectId(spaceId)) {
    const stillOccupied = await Tenancy.exists({
      space: spaceId,
      status: { $in: occupiedTenancyStatuses },
    });
    if (!stillOccupied) {
      await PropertySpace.updateOne(
        { _id: spaceId, property: propertyId, deletedAt: null, status: { $in: ['occupied', 'rented', 'leased'] } },
        { $set: { status: 'available', updatedBy: actorId } },
      );
    }
    return;
  }

  if (mongoose.isValidObjectId(propertyId)) {
    const stillOccupied = await Tenancy.exists({
      property: propertyId,
      status: { $in: occupiedTenancyStatuses },
    });
    if (!stillOccupied) {
      await Property.updateOne(
        { _id: propertyId, deletedAt: null, status: { $in: ['occupied', 'rented', 'leased'] } },
        { $set: { status: 'available', updatedBy: actorId } },
      );
    }
  }
}

async function startAgreementCycle(req, request, { securityDepositPaid = false } = {}) {
  if (!ACTIVE_CYCLE_AGREEMENT_TYPES.has(request.agreementType)) return { tenancy: null, startsAt: null, endsAt: null, dueAt: null, termMonths: 0 };
  const application = request.application;
  const property = request.property;
  const rentalUnitId = request.rentalUnit?._id || request.rentalUnit || application?.rentalUnit?._id || application?.rentalUnit;
  const rentalUnit = mongoose.isValidObjectId(rentalUnitId)
    ? await RentalUnit.findOne({ _id: rentalUnitId, property: property?._id })
    : null;
  if (!application?._id || !property?._id) throw new ApiError(409, 'The approved application or property is unavailable for the tenancy cycle');

  const now = new Date();
  const termMonths = cycleTermMonths(request);
  const startsAt = validDate(request.startDate) || now;
  const endsAt = validDate(request.endDate) || addCalendarMonthsClamped(startsAt, termMonths);
  const dueDay = cycleDueDay(application, startsAt);
  const dueTime = '09:00';
  let tenancy = await tenancyForAgreement(request);

  if (request.renewalOf) {
    if (!tenancy) throw new ApiError(409, 'The active tenancy for this renewal agreement could not be found');
    const previousAgreementId = tenancy.agreement?._id || tenancy.agreement;
    if (mongoose.isValidObjectId(previousAgreementId) && String(previousAgreementId) !== String(request._id)) {
      tenancy.agreementHistory ||= [];
      if (!tenancy.agreementHistory.some((item) => String(item?._id || item) === String(previousAgreementId))) tenancy.agreementHistory.push(previousAgreementId);
    }
    tenancy.agreement = request._id;
    tenancy.startDate = startsAt;
    tenancy.endDate = endsAt;
    tenancy.durationMonths = termMonths;
    tenancy.updatedBy = req.user._id;
    await tenancy.save();
    const renewalDueAt = nextMonthlyDueAt(now, tenancy.dueDay || dueDay, tenancy.dueTime || dueTime);
    request.tenancy = tenancy._id;
    request.cycleStartedAt = startsAt;
    request.cycleEndsAt = endsAt;
    request.nextDueAt = renewalDueAt;
    request.cycleTermMonths = termMonths;
    return { tenancy, startsAt, endsAt, dueAt: renewalDueAt, termMonths, initialInvoice: null };
  }

  if (!tenancy) {
    if (capabilityRolesForUser(req.user).includes('landlord')) await assertLandlordLimit(req.user._id, 'activeTenants');
    tenancy = await Tenancy.create({
      tenant: request.tenant?._id || request.tenant,
      landlord: request.landlord?._id || request.landlord,
      property: property._id,
      space: request.space?._id || request.space,
      application: application._id,
      rentalUnit: rentalUnit?._id,
      agreement: request._id,
      tenancyNumber: rentalUnit ? `TNC-${String(rentalUnit._id).slice(-6).toUpperCase()}-${Date.now().toString().slice(-6)}` : undefined,
      status: rentalUnit ? 'payment_pending' : 'active',
      startDate: startsAt,
      endDate: endsAt,
      durationMonths: termMonths,
      monthlyRent: agreementAmount(property, request.agreementType, rentalUnit),
      securityDeposit: rentalUnit?.pricing?.securityDeposit ?? property.pricing?.securityDeposit,
      maintenanceCharge: rentalUnit?.pricing?.maintenanceCharge || 0,
      bookingAmount: rentalUnit?.pricing?.bookingAmount || 0,
      pricingSnapshot: rentalUnit?.pricing?.toObject?.() || rentalUnit?.pricing || {},
      dueDay,
      dueTime,
      occupants: application.occupantIds || [],
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
  } else {
    tenancy.tenant = request.tenant?._id || request.tenant;
    tenancy.landlord = request.landlord?._id || request.landlord;
    tenancy.property = property._id;
    tenancy.space = request.space?._id || request.space;
    tenancy.application = application._id;
    tenancy.rentalUnit = rentalUnit?._id;
    tenancy.agreement = request._id;
    tenancy.tenancyNumber ||= rentalUnit ? `TNC-${String(rentalUnit._id).slice(-6).toUpperCase()}-${Date.now().toString().slice(-6)}` : undefined;
    tenancy.status = rentalUnit ? 'payment_pending' : 'active';
    tenancy.startDate = startsAt;
    tenancy.endDate = endsAt;
    tenancy.durationMonths = termMonths;
    tenancy.monthlyRent = agreementAmount(property, request.agreementType, rentalUnit);
    tenancy.securityDeposit = rentalUnit?.pricing?.securityDeposit ?? property.pricing?.securityDeposit;
    tenancy.maintenanceCharge = rentalUnit?.pricing?.maintenanceCharge || 0;
    tenancy.bookingAmount = rentalUnit?.pricing?.bookingAmount || 0;
    tenancy.pricingSnapshot = rentalUnit?.pricing?.toObject?.() || rentalUnit?.pricing || {};
    tenancy.dueDay = dueDay;
    tenancy.dueTime = dueTime;
    tenancy.updatedBy = req.user._id;
    await tenancy.save();
  }

  const dueAt = nextMonthlyDueAt(now, tenancy.dueDay || dueDay, tenancy.dueTime || dueTime);
  request.tenancy = tenancy._id;
  request.cycleStartedAt = startsAt;
  request.cycleEndsAt = endsAt;
  request.nextDueAt = dueAt;
  request.cycleTermMonths = termMonths;
  let initialInvoice = null;
  if (rentalUnit) {
    await transitionRentalUnitToPaymentPending(rentalUnit, {
      actorId: req.user._id,
      reason: 'Agreement approved; required initial payment is pending',
    });
    ({ invoice: initialInvoice } = await ensureInitialRentalInvoice(tenancy, rentalUnit, now, { securityDepositPaid }));
    await syncPropertyRentalSummary(property._id, req.user._id);
  } else {
    await markCyclePropertyOccupied(request, req.user._id);
  }
  return { tenancy, startsAt, endsAt, dueAt, termMonths, initialInvoice };
}

function stampFileName(request) {
  const base = cleanText(request.renderedTitle, `${request.agreementType}-agreement`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'agreement';
  return `${base}-${String(request._id).slice(-8)}.pdf`;
}

function requiredTransparentPng(file) {
  if (!file?.buffer?.length) throw new ApiError(422, 'Choose a signature or stamp/seal image to upload');
  if (Number(file.size || file.buffer.length) > MAX_MARK_BYTES) throw new ApiError(413, 'Signature or stamp/seal images must be 5 MB or smaller');
  return fileTypeFromBuffer(file.buffer).then((detected) => {
    if (detected?.mime !== INTERNAL_MARK_MIME || !isTransparentPng(file.buffer)) {
      throw new ApiError(422, 'Upload a PNG signature with a transparent background. SecureAsset converts selected JPG and PNG images automatically before upload.');
    }
    return detected;
  });
}

async function persistPartyMark(req, request, party, kind) {
  await requiredTransparentPng(req.file);
  await assertStorageAvailable(req.user._id, req.file.size);
  const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const label = party === 'first' ? 'first-party' : 'second-party';
  const descriptor = kind === 'stamp_seal' ? 'stamp-seal' : 'signature';
  const filename = `${label}-${descriptor}-${Date.now()}.png`;
  const storageKey = buildStorageKey(req.user._id, filename, 'agreement-signatures');
  const stored = await saveBuffer(req.file.buffer, storageKey, INTERNAL_MARK_MIME);
  const driveFile = await DriveFile.create({
    owner: req.user._id,
    name: filename,
    originalName: req.file.originalname || filename,
    description: `${party === 'first' ? 'First-party' : 'Second-party'} ${descriptor.replace('_', ' ')} for agreement ${request._id}`,
    extension: '.png',
    mimeType: INTERNAL_MARK_MIME,
    category: 'legal',
    storageDriver: stored.driver,
    storageKey: stored.key,
    sizeBytes: req.file.size,
    checksum,
    visibility: 'private',
    confidentiality: 'legal_record',
    immutable: true,
    tags: ['agreement', 'signature', party === 'first' ? 'first-party' : 'second-party'],
    relations: { property: request.property?._id || request.property, user: req.user._id },
    legalMetadata: { documentType: 'agreement_signature', signatureStatus: 'uploaded', relatedParties: [String(request.landlord?._id || request.landlord), String(request.tenant?._id || request.tenant)] },
    preview: { status: 'ready' },
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  await DriveFileVersion.create({
    file: driveFile._id,
    owner: req.user._id,
    version: 1,
    storageDriver: stored.driver,
    storageKey: stored.key,
    sizeBytes: req.file.size,
    checksum,
    mimeType: INTERNAL_MARK_MIME,
    changeDescription: `Uploaded ${label} ${descriptor} for agreement signing`,
    signatureStatus: 'uploaded',
    immutable: true,
    uploadedBy: req.user._id,
  });
  await changeUsage(req.user._id, req.file.size, 'legal');
  await logDriveActivity(req, driveFile, 'file_uploaded', { agreementRequest: request._id, party, kind, backgroundRemoved: true });
  return {
    file: driveFile._id,
    kind,
    name: filename,
    mimeType: INTERNAL_MARK_MIME,
    checksum,
    backgroundRemoved: true,
    uploadedAt: new Date(),
    signedBy: req.user._id,
  };
}

export const listAgreementTemplates = asyncHandler(async (req, res) => {
  if (!isAgreementManager(req.user)) throw new ApiError(403, 'Landlord agreement access is required');
  await ensureDefaultTemplates(req.user._id);
  const filter = { owner: req.user._id };
  if (req.query.agreementType) filter.agreementType = normalizeType(req.query.agreementType);
  const data = await AgreementTemplate.find(filter).sort({ agreementType: 1, createdAt: 1 }).lean();
  res.json({ success: true, data });
});

export const createAgreementTemplate = asyncHandler(async (req, res) => {
  if (!isAgreementManager(req.user)) throw new ApiError(403, 'Landlord agreement access is required');
  const requestedType = String(req.body.agreementType || '').trim().toLowerCase();
  if (!AGREEMENT_TYPES.has(requestedType)) throw new ApiError(422, 'Choose rent, lease or sale agreement type');
  const name = cleanText(req.body.name);
  const title = cleanText(req.body.title);
  const body = cleanText(req.body.body);
  if (!name || !title || !body) throw new ApiError(422, 'Template name, title and agreement body are required');
  const key = templateKey(req.body.key || name);
  if (!key) throw new ApiError(422, 'Template name must contain letters or numbers');
  const template = await AgreementTemplate.create({
    owner: req.user._id, key, name, title, body, agreementType: requestedType,
    stampPaper: normalizeStampPaper(req.body.stampPaper), active: req.body.active !== false,
    createdBy: req.user._id, updatedBy: req.user._id,
  });
  await writeAudit(req, { action: 'create', module: 'agreement-templates', recordId: template._id, updatedValue: template.toObject() });
  res.status(201).json({ success: true, data: template });
});

export const updateAgreementTemplate = asyncHandler(async (req, res) => {
  if (!isAgreementManager(req.user)) throw new ApiError(403, 'Landlord agreement access is required');
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Agreement template not found');
  const template = await AgreementTemplate.findOne({ _id: req.params.id, owner: req.user._id });
  if (!template) throw new ApiError(404, 'Agreement template not found');
  const previousValue = template.toObject();
  if (req.body.agreementType !== undefined) {
    const requestedType = String(req.body.agreementType).trim().toLowerCase();
    if (!AGREEMENT_TYPES.has(requestedType)) throw new ApiError(422, 'Choose rent, lease or sale agreement type');
    if (requestedType !== template.agreementType) throw new ApiError(422, 'Agreement type cannot change; create a new template instead');
  }
  for (const field of ['name', 'title', 'body']) {
    if (req.body[field] !== undefined) {
      const value = cleanText(req.body[field]);
      if (!value) throw new ApiError(422, `${field} cannot be empty`);
      template[field] = value;
    }
  }
  if (req.body.key !== undefined) {
    const key = templateKey(req.body.key);
    if (!key) throw new ApiError(422, 'Template key cannot be empty');
    template.key = key;
  }
  if (req.body.stampPaper !== undefined) template.stampPaper = normalizeStampPaper(req.body.stampPaper);
  if (req.body.active !== undefined) template.active = Boolean(req.body.active);
  template.version = Number(template.version || 1) + 1;
  template.updatedBy = req.user._id;
  await template.save();
  await writeAudit(req, { action: 'update', module: 'agreement-templates', recordId: template._id, previousValue, updatedValue: template.toObject() });
  res.json({ success: true, data: template });
});

export const deleteAgreementTemplate = asyncHandler(async (req, res) => {
  if (!isAgreementManager(req.user)) throw new ApiError(403, 'Landlord agreement access is required');
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Agreement template not found');
  const template = await AgreementTemplate.findOne({ _id: req.params.id, owner: req.user._id });
  if (!template) throw new ApiError(404, 'Agreement template not found');
  const used = await AgreementRequest.exists({ template: template._id, status: { $in: ['sent', 'viewed', 'awaiting_first_party_approval', 'approved', 'signed', 'cancelled', 'closed'] } });
  if (used) throw new ApiError(409, 'This template is used by an active agreement request; deactivate it instead');
  await template.deleteOne();
  await writeAudit(req, { action: 'delete', module: 'agreement-templates', recordId: template._id, previousValue: template.toObject() });
  res.json({ success: true, message: 'Agreement template deleted' });
});

export const prepareAgreementRequest = asyncHandler(async (req, res) => {
  if (!isAgreementManager(req.user)) throw new ApiError(403, 'Landlord agreement access is required');
  const application = await loadApplication(req.body.application);
  if (!isApplicationAccepted(application.status)) throw new ApiError(409, 'Accept the application before preparing its agreement');
  const property = application.property;
  if (String(req.user.role || '').toLowerCase() !== 'admin' && !sameId(property.owner, req.user._id) && !sameId(application.landlord, req.user._id)) {
    throw new ApiError(403, 'You can only prepare agreements for your own properties');
  }
  const agreementType = normalizeType(property.purpose || property.listingType || (property.isSale ? 'sale' : 'rent'));
  let durationMonths;
  let startDate;
  let endDate;
  if (ACTIVE_CYCLE_AGREEMENT_TYPES.has(agreementType)) {
    durationMonths = Number(req.body.durationMonths);
    if (!Number.isInteger(durationMonths) || durationMonths < 1) throw new ApiError(422, 'Agreement duration must be a positive whole number of months');
    startDate = parseAgreementDate(req.body.startDate);
    if (!startDate) throw new ApiError(422, 'Choose a valid agreement start date');
    endDate = addCalendarMonthsClamped(startDate, durationMonths);
  }
  const renewalOfId = String(req.body.renewalOf || '').trim();
  let renewalSource = null;
  let renewalTenancy = null;
  if (renewalOfId) {
    if (!mongoose.isValidObjectId(renewalOfId)) throw new ApiError(422, 'The agreement being renewed is invalid');
    renewalSource = await AgreementRequest.findById(renewalOfId);
    if (!renewalSource || renewalSource.status !== 'approved' || !ACTIVE_CYCLE_AGREEMENT_TYPES.has(renewalSource.agreementType) || !sameId(renewalSource.application, application._id) || !sameId(renewalSource.landlord, req.user._id)) {
      throw new ApiError(409, 'Choose an active approved rent or lease agreement to renew');
    }
    renewalTenancy = await tenancyForAgreement(renewalSource);
    if (!renewalTenancy || !['active', 'payment_pending'].includes(String(renewalTenancy.status || ''))) throw new ApiError(409, 'Only an active tenancy can receive a renewal agreement');
  }
  if (!mongoose.isValidObjectId(req.body.template)) throw new ApiError(422, 'Choose an agreement template');
  const template = await AgreementTemplate.findOne({ _id: req.body.template, owner: req.user._id, active: true });
  if (!template) throw new ApiError(404, 'Agreement template not found or inactive');
  if (template.agreementType !== agreementType) throw new ApiError(422, `Choose a ${agreementType} agreement template for this property`);

  const activeRequest = await AgreementRequest.findOne(renewalSource ? {
    renewalOf: renewalSource._id,
    status: { $in: ['draft', 'first_party_signed', 'configuration_required', 'sent', 'viewed', 'awaiting_first_party_approval', 'approved'] },
  } : {
    application: application._id,
    status: { $in: ['draft', 'first_party_signed', 'configuration_required', 'sent', 'viewed', 'awaiting_first_party_approval', 'approved'] },
  }).sort({ createdAt: -1 });
  if (activeRequest && ['sent', 'viewed', 'awaiting_first_party_approval', 'approved'].includes(activeRequest.status)) {
    throw new ApiError(409, 'A signature request is already active for this application');
  }
  if (activeRequest && (activeRequest.status === 'first_party_signed' || hasMark(activeRequest.firstPartyMark))) {
    throw new ApiError(409, 'The first-party mark is already uploaded. Send this agreement to the second party or create a new agreement after it is finished.');
  }

  const applicant = application.applicant?._id ? application.applicant : await User.findById(application.applicant).select('name email phone');
  const landlord = property.owner?._id ? property.owner : await User.findById(property.owner).select('name email phone');
  if (!applicant?._id) throw new ApiError(404, 'The application tenant could not be found');
  if (!landlord?._id) throw new ApiError(404, 'The first party could not be found');
  const landlordName = cleanText(landlord?.name || req.user.name, 'First party');
  const tenantName = cleanText(applicant?.name, 'Second party');
  const rentalUnit = application.rentalUnit;
  if (agreementType === 'rent' && application.rentalUnit && !rentalUnit?._id) {
    throw new ApiError(409, 'The selected rental room could not be loaded');
  }
  const amount = agreementAmount(property, agreementType, rentalUnit);
  const amountLabel = agreementType === 'sale' ? 'Sale consideration' : agreementType === 'lease' ? 'Lease amount' : 'Monthly rent';
  const renderedTitle = renderTemplate(template.title, { agreement_type: agreementType, property_title: property.title, tenant_name: tenantName, landlord_name: landlordName });
  let renderedBody = renderTemplate(template.body, {
    agreement_date: new Date().toLocaleDateString('en-IN'), agreement_type: agreementType,
    landlord_name: landlordName, tenant_name: tenantName, property_title: property.title,
    property_address: addressText(property), space_name: applicationSpaceName(application),
    amount_label: amountLabel, amount: formatMoney(amount),
    duration_months: durationMonths || '', start_date: startDate ? formatAgreementDate(startDate) : '', end_date: endDate ? formatAgreementDate(endDate) : '',
    security_deposit: formatMoney(rentalUnit?.pricing?.securityDeposit ?? property.pricing?.securityDeposit),
    stamp_state: template.stampPaper?.state, stamp_denomination: template.stampPaper?.denomination, stamp_series: template.stampPaper?.series,
  });
  const templateHasTermFields = ['duration_months', 'start_date', 'end_date'].every((key) => new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'i').test(template.body));
  if (durationMonths && !templateHasTermFields) {
    renderedBody += `\n\nAGREEMENT TERM\nDuration: ${durationMonths} month${durationMonths === 1 ? '' : 's'}\nStart date: ${formatAgreementDate(startDate)}\nEnd date: ${formatAgreementDate(endDate)}\nRent and due dates continue on a monthly cycle throughout the agreement term.`;
  }
  const requestValues = {
    application: application._id,
    property: property._id,
    space: application.targetSpace?._id || application.targetSpace,
    rentalUnit: rentalUnit?._id || rentalUnit,
    landlord: property.owner?._id || property.owner,
    tenant: applicant._id,
    template: template._id,
    agreementType,
    status: 'draft',
    provider: 'internal_signature',
    providerEnvelopeId: undefined,
    stampPaper: normalizeStampPaper(template.stampPaper),
    renderedTitle,
    renderedBody,
    tenantName,
    tenantEmail: cleanText(applicant?.email).toLowerCase(),
    landlordName,
    landlordEmail: cleanText(landlord?.email || req.user.email).toLowerCase(),
    firstPartyMark: undefined,
    secondPartySignature: undefined,
    firstPartySignedAt: undefined,
    secondPartyAcceptedAt: undefined,
    secondPartySignedAt: undefined,
    firstPartyVerificationAt: undefined,
    firstPartyVerifiedBy: undefined,
    firstPartyApprovalAt: undefined,
    firstPartyApprovedBy: undefined,
    firstPartyVerificationNote: '',
    tenancy: undefined,
    securityDepositPayment: undefined,
    cycleStartedAt: undefined,
    cycleEndsAt: undefined,
    nextDueAt: undefined,
    renewalOf: renewalSource?._id,
    durationMonths,
    startDate,
    endDate,
    cycleTermMonths: durationMonths,
    ...(renewalTenancy ? { tenancy: renewalTenancy._id } : {}),
    renewalRequestedAt: undefined,
    renewalRequestedBy: undefined,
    renewalHistory: [],
    cancellationRequestedAt: undefined,
    cancellationRequestedBy: undefined,
    cancellationReason: '',
    cancellationResolvedAt: undefined,
    cancellationResolvedBy: undefined,
    cancellationResolution: 'none',
    cancelledAt: undefined,
    cancelledBy: undefined,
    closedAt: undefined,
    closedBy: undefined,
    sentAt: undefined,
    viewedAt: undefined,
    signedAt: undefined,
    lastError: '',
    updatedBy: req.user._id,
  };
  const request = activeRequest || new AgreementRequest({ createdBy: req.user._id });
  request.set(requestValues);
  await request.save();
  await writeAudit(req, { action: 'prepare', module: 'agreement-requests', recordId: request._id, updatedValue: request.toObject() });
  res.status(201).json({
    success: true,
    data: request,
    message: 'Agreement prepared. Upload the first-party signature or stamp/seal before sending it to the second party.',
  });
});

export const uploadFirstPartyMark = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  if (!isAgreementManager(req.user) || !sameId(request.landlord, req.user._id)) {
    throw new ApiError(403, 'Only the landlord-enabled first party can upload this signature or stamp/seal');
  }
  if (!['draft', 'first_party_signed', 'configuration_required'].includes(request.status)) {
    throw new ApiError(409, 'The first-party mark is locked after the agreement is sent');
  }
  const kind = String(req.body.markType || '').trim().toLowerCase();
  if (!FIRST_PARTY_MARK_TYPES.has(kind)) throw new ApiError(422, 'Choose whether this upload is a signature or stamp/seal');
  const previousValue = request.toObject();
  const mark = await persistPartyMark(req, request, 'first', kind);
  request.provider = 'internal_signature';
  request.providerEnvelopeId = undefined;
  request.firstPartyMark = mark;
  request.firstPartySignedAt = mark.uploadedAt;
  request.status = 'first_party_signed';
  request.lastError = '';
  request.updatedBy = req.user._id;
  await request.save();
  await writeAudit(req, { action: 'first-party-mark-uploaded', module: 'agreement-requests', recordId: request._id, previousValue, updatedValue: request.toObject() });
  res.json({ success: true, data: request, message: 'First-party mark uploaded with a transparent background. You can now send the agreement to the second party.' });
});

export const sendInternalAgreementRequest = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  if (!isAgreementManager(req.user) || !sameId(request.landlord, req.user._id)) {
    throw new ApiError(403, 'Only the landlord-enabled first party can send this agreement');
  }
  if (request.provider !== 'internal_signature') throw new ApiError(409, 'Prepare a new internal signature agreement before sending it');
  if (!hasMark(request.firstPartyMark)) throw new ApiError(409, 'Upload the first-party signature or stamp/seal before requesting the second-party signature');
  if (request.status === 'signed') throw new ApiError(409, 'This agreement has already been signed');
  if (!['first_party_signed', 'draft'].includes(request.status)) throw new ApiError(409, 'This agreement cannot be sent in its current state');
  const application = request.application;
  if (!application || !isApplicationAccepted(application.status)) throw new ApiError(409, 'The application is no longer accepted');
  request.status = 'sent';
  request.sentAt = new Date();
  request.lastError = '';
  request.updatedBy = req.user._id;
  await request.save();
  application.status = 'agreement_pending';
  application.updatedBy = req.user._id;
  await application.save();
  await createNotification({
    user: request.tenant?._id || request.tenant,
    title: 'Agreement signature requested',
    message: `The first party has signed the ${request.agreementType} agreement. Review it and upload your signature.`,
    category: 'lease',
    actionUrl: `/app/my-applications?record=${request.application?._id || request.application}`,
    metadata: { agreementRequest: request._id, agreementType: request.agreementType, workflow: 'internal_two_party_signature' },
  });
  await writeAudit(req, { action: 'send', module: 'agreement-requests', recordId: request._id, updatedValue: request.toObject() });
  res.json({ success: true, data: request, message: 'Agreement sent to the second party for signature.' });
});

export const uploadSecondPartySignature = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  if (!sameId(request.tenant, req.user._id)) throw new ApiError(403, 'Only the requested second party can upload this signature');
  if (!['sent', 'viewed'].includes(request.status)) throw new ApiError(409, 'This agreement is not ready for the second-party signature');
  if (String(req.body.accepted || '').toLowerCase() !== 'true') throw new ApiError(422, 'Confirm that you agree to sign this agreement before uploading your signature');
  const previousValue = request.toObject();
  const mark = await persistPartyMark(req, request, 'second', 'signature');
  request.secondPartySignature = mark;
  request.secondPartyAcceptedAt = new Date();
  request.secondPartySignedAt = mark.uploadedAt;
  // The applicant's upload is intentionally not the final approval. The
  // landlord-enabled first party must verify this mark and explicitly start
  // the resulting rent or lease cycle.
  request.status = 'awaiting_first_party_approval';
  request.signedAt = undefined;
  request.lastError = '';
  request.updatedBy = req.user._id;
  await request.save();

  const securityDepositPayment = await ensureSecurityDepositPayment(request, req.user._id);
  if (securityDepositPayment) {
    request.securityDepositPayment = securityDepositPayment._id;
    await request.save();
    if (request.application?.save) {
      request.application.status = 'deposit_pending';
      request.application.updatedBy = req.user._id;
      await request.application.save();
    }
    await createNotification({
      user: request.tenant?._id || request.tenant,
      title: 'Security deposit payment required',
      message: `Your agreement is signed. Pay the security deposit of INR ${Number(securityDepositPayment.amount || 0).toLocaleString('en-IN')}, enter the transaction ID and upload payment proof before the landlord can start the ${request.agreementType === 'lease' ? 'lease' : 'rent'} workflow.`,
      category: 'payment',
      actionUrl: `/app/my-applications?record=${request.application?._id || request.application}`,
      metadata: { agreementRequest: request._id, paymentId: securityDepositPayment._id, event: 'security_deposit_required' },
    });
  }

  await createNotification({
    user: request.landlord?._id || request.landlord,
    title: securityDepositPayment ? 'Agreement signed · security deposit pending' : 'Agreement signature awaiting your approval',
    message: securityDepositPayment
      ? `${request.tenantName || 'The applicant tenant'} signed the agreement. Wait for the security deposit payment and proof before verifying and starting the ${request.agreementType === 'lease' ? 'lease' : 'rent'} workflow.`
      : `${request.tenantName || 'The applicant tenant'} uploaded their signature for the ${request.agreementType} agreement. Verify it and approve the agreement to start the ${request.agreementType === 'lease' ? 'lease' : request.agreementType === 'rent' ? 'rent' : 'sale'} workflow.`,
    category: securityDepositPayment ? 'payment' : 'lease',
    actionUrl: `/app/applications?record=${request.application?._id || request.application}`,
    metadata: {
      agreementRequest: request._id,
      agreementType: request.agreementType,
      workflow: 'internal_two_party_signature',
      awaitingFirstPartyApproval: true,
      securityDepositPending: Boolean(securityDepositPayment),
    },
  });

  if (securityDepositPayment) await request.populate('securityDepositPayment');
  await writeAudit(req, { action: 'second-party-signature-uploaded', module: 'agreement-requests', recordId: request._id, previousValue, updatedValue: request.toObject() });
  res.json({
    success: true,
    data: requestPayload(request, null),
    message: securityDepositPayment
      ? 'Your signature was submitted. Pay the required security deposit and submit the transaction ID with payment proof for landlord review.'
      : 'Your signature was submitted. It is now waiting for the landlord-enabled first party to verify and approve it.',
  });
});

export const submitAgreementSecurityDeposit = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  if (!sameId(request.tenant, req.user._id)) throw new ApiError(403, 'Only the applicant tenant can submit this security deposit');
  if (visibleRequestStatus(request) !== 'awaiting_first_party_approval') {
    throw new ApiError(409, 'Complete the agreement signatures before submitting the security deposit');
  }

  const amount = securityDepositAmount(request);
  if (amount <= 0) throw new ApiError(409, 'This agreement does not require a security deposit payment');

  const transactionId = cleanText(req.body?.transactionId).slice(0, 120);
  if (!transactionId) throw new ApiError(422, 'Enter the security deposit transaction ID');
  if (!req.file?.buffer?.length) throw new ApiError(422, 'Upload payment proof before submitting');

  const payment = await ensureSecurityDepositPayment(request, req.user._id);
  const stage = depositVerificationStatus(payment);
  if (!['awaiting_tenant', 'rejected'].includes(stage)) {
    throw new ApiError(409, stage === 'approved'
      ? 'The security deposit is already verified'
      : 'The security deposit is already waiting for landlord review');
  }

  if (await Payment.exists({ _id: { $ne: payment._id }, transactionId })) {
    throw new ApiError(409, 'This transaction ID is already attached to another payment');
  }

  const previousValue = payment.toObject();
  const proof = await persistSecurityDepositProof(req, request);
  const now = new Date();

  payment.amount = amount;
  payment.paidAmount = 0;
  payment.status = 'pending';
  payment.method = 'bank_transfer';
  payment.transactionId = transactionId;
  payment.proofFile = proof._id;
  payment.proofUrl = `/api/v1/agreements/requests/${request._id}/security-deposit-proof`;
  payment.gateway = {
    ...(payment.gateway || {}),
    source: 'security_deposit',
    agreementRequest: String(request._id),
    approvalRequired: 'landlord',
    submittedAt: now,
  };
  payment.paymentVerification = {
    ...(payment.paymentVerification?.toObject?.() || payment.paymentVerification || {}),
    status: 'submitted',
    submittedAt: now,
    submittedBy: req.user._id,
    approvedAt: undefined,
    approvedBy: undefined,
    rejectedAt: undefined,
    rejectedBy: undefined,
    rejectionReason: undefined,
    submissionCount: Number(payment.paymentVerification?.submissionCount || 0) + 1,
  };
  payment.updatedBy = req.user._id;
  await payment.save();

  request.securityDepositPayment = payment._id;
  request.updatedBy = req.user._id;
  await request.save();

  if (request.application?.save) {
    request.application.status = 'deposit_pending';
    request.application.updatedBy = req.user._id;
    request.application.activity ||= [];
    request.application.activity.push({
      kind: 'security_deposit_submitted',
      title: 'Security deposit payment submitted',
      detail: `Transaction ID: ${transactionId}`,
      actor: req.user._id,
      audience: 'all',
      at: now,
    });
    await request.application.save();
  }

  await createNotification({
    user: request.landlord?._id || request.landlord,
    title: 'Security deposit awaiting verification',
    message: `${request.tenantName || 'The applicant tenant'} submitted INR ${amount.toLocaleString('en-IN')} with transaction ID ${transactionId}. Review the payment proof, then verify and start the ${request.agreementType === 'lease' ? 'lease' : 'rent'} workflow.`,
    category: 'payment',
    actionUrl: `/app/application_details/${request.application?._id || request.application}`,
    metadata: { agreementRequest: request._id, paymentId: payment._id, event: 'security_deposit_submitted' },
  });

  await writeAudit(req, {
    action: 'security-deposit:submitted',
    module: 'payments',
    recordId: payment._id,
    previousValue,
    updatedValue: payment.toObject(),
  });
  await request.populate('securityDepositPayment');
  res.status(201).json({
    success: true,
    data: requestPayload(request, null),
    message: 'Security deposit payment submitted for landlord review.',
  });
});

export const rejectAgreementSecurityDeposit = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  assertSecurityDepositLandlord(request, req.user);

  const paymentId = request.securityDepositPayment?._id || request.securityDepositPayment;
  const payment = mongoose.isValidObjectId(paymentId) ? await Payment.findById(paymentId) : null;
  if (!payment || depositVerificationStatus(payment) !== 'submitted') {
    throw new ApiError(409, 'Only a submitted security deposit can be rejected');
  }

  const reason = cleanText(req.body?.reason).slice(0, 1000);
  if (!reason) throw new ApiError(422, 'Provide a rejection reason for the tenant');

  const previousValue = payment.toObject();
  const now = new Date();
  payment.status = 'pending';
  payment.paidAmount = 0;
  payment.paidAt = undefined;
  payment.paymentVerification = {
    ...(payment.paymentVerification?.toObject?.() || payment.paymentVerification || {}),
    status: 'rejected',
    rejectedAt: now,
    rejectedBy: req.user._id,
    rejectionReason: reason,
    approvedAt: undefined,
    approvedBy: undefined,
  };
  payment.updatedBy = req.user._id;
  await payment.save();

  await createNotification({
    user: request.tenant?._id || request.tenant,
    title: 'Security deposit payment needs attention',
    message: `Your security deposit payment was not verified: ${reason}. Submit the transaction ID and corrected payment proof again.`,
    category: 'payment',
    actionUrl: `/app/my-applications?record=${request.application?._id || request.application}`,
    metadata: { agreementRequest: request._id, paymentId: payment._id, event: 'security_deposit_rejected' },
  });

  await writeAudit(req, {
    action: 'security-deposit:rejected',
    module: 'payments',
    recordId: payment._id,
    previousValue,
    updatedValue: payment.toObject(),
  });
  await request.populate('securityDepositPayment');
  res.json({
    success: true,
    data: requestPayload(request, null),
    message: 'Security deposit payment rejected. The tenant can resubmit it.',
  });
});

export const getAgreementSecurityDepositProof = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  const paymentId = request.securityDepositPayment?._id || request.securityDepositPayment;
  const payment = mongoose.isValidObjectId(paymentId) ? await Payment.findById(paymentId) : null;
  if (!payment?.proofFile) throw new ApiError(404, 'Security deposit payment proof has not been uploaded');

  const file = await DriveFile.findOne({ _id: payment.proofFile, status: { $ne: 'trashed' } }).select('+storageKey');
  if (!file?.storageKey) throw new ApiError(404, 'Security deposit payment proof not found');

  const buffer = await readBuffer(file.storageDriver, file.storageKey);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName || file.name || 'security-deposit-proof')}`);
  res.send(buffer);
});

export const approveAgreementRequest = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  assertFirstParty(request, req.user, 'Only the landlord-enabled first party can verify and approve this agreement');
  const status = visibleRequestStatus(request);
  if (!['awaiting_first_party_approval', 'signed'].includes(status)) {
    throw new ApiError(409, 'The second-party signature must be submitted before the agreement can be approved');
  }
  if (!hasMark(request.firstPartyMark) || !hasMark(request.secondPartySignature)) {
    throw new ApiError(409, 'Both private party marks are required before approval');
  }

  const requiredDepositAmount = securityDepositAmount(request);
  let securityDepositPayment = null;
  if (requiredDepositAmount > 0) {
    assertSecurityDepositLandlord(
      request,
      req.user,
      'Only the receiving landlord can verify the security deposit and start the rent workflow',
    );
    const paymentId = request.securityDepositPayment?._id || request.securityDepositPayment;
    securityDepositPayment = mongoose.isValidObjectId(paymentId) ? await Payment.findById(paymentId) : null;
    const depositStage = depositVerificationStatus(securityDepositPayment);
    if (!securityDepositPayment || !['submitted', 'approved'].includes(depositStage)) {
      throw new ApiError(409, 'The tenant must submit the required security deposit transaction ID and payment proof before you can start the rent workflow');
    }
    if (!securityDepositPayment.transactionId || !securityDepositPayment.proofFile) {
      throw new ApiError(409, 'Reviewable security deposit transaction details and payment proof are required before approval');
    }
  }

  const previousValue = request.toObject();
  const depositPreviousValue = securityDepositPayment?.toObject?.();
  const { tenancy, startsAt, endsAt, dueAt, termMonths } = await startAgreementCycle(
    req,
    request,
    { securityDepositPaid: requiredDepositAmount > 0 },
  );
  const now = new Date();

  if (securityDepositPayment) {
    securityDepositPayment.amount = requiredDepositAmount;
    securityDepositPayment.paidAmount = requiredDepositAmount;
    securityDepositPayment.status = 'paid';
    securityDepositPayment.paidAt = now;
    if (tenancy?._id) securityDepositPayment.tenancy = tenancy._id;
    securityDepositPayment.paymentVerification = {
      ...(securityDepositPayment.paymentVerification?.toObject?.() || securityDepositPayment.paymentVerification || {}),
      status: 'approved',
      approvedAt: now,
      approvedBy: req.user._id,
      rejectedAt: undefined,
      rejectedBy: undefined,
      rejectionReason: undefined,
    };
    securityDepositPayment.updatedBy = req.user._id;
    await securityDepositPayment.save();
    await writeAudit(req, {
      action: 'security-deposit:verified',
      module: 'payments',
      recordId: securityDepositPayment._id,
      previousValue: depositPreviousValue,
      updatedValue: securityDepositPayment.toObject(),
    });
  }
  request.status = 'approved';
  request.firstPartyVerificationAt = now;
  request.firstPartyVerifiedBy = req.user._id;
  request.firstPartyApprovalAt = now;
  request.firstPartyApprovedBy = req.user._id;
  request.firstPartyVerificationNote = cleanText(req.body?.note).slice(0, 1200);
  request.signedAt = now;
  request.lastError = '';
  request.updatedBy = req.user._id;
  await request.save();

  if (request.application?.save) {
    request.application.status = 'completed';
    request.application.updatedBy = req.user._id;
    await request.application.save();
  }
  if (request.rentalUnit) {
    const waitingApplications = await Application.find({
      _id: { $ne: request.application?._id || request.application },
      rentalUnit: request.rentalUnit?._id || request.rentalUnit,
      status: { $in: ['submitted', 'under_review', 'shortlisted', 'interview_requested', 'interview_scheduled', 'site_visit_scheduled', 'additional_documents_requested', 'documents_pending', 'approved', 'agreement_pending', 'deposit_pending'] },
    }).select('_id applicant applicationNumber');
    if (waitingApplications.length) {
      await Application.updateMany({ _id: { $in: waitingApplications.map((item) => item._id) } }, { $set: { status: 'waiting_list', closedReason: 'The room became unavailable after agreement completion', updatedBy: req.user._id } });
      await Promise.all(waitingApplications.map((item) => createNotification({
        user: item.applicant,
        title: 'Application moved to waiting list',
        message: 'The room became unavailable after another tenant completed the agreement workflow.',
        category: 'system',
        actionUrl: `/app/application_details/${item._id}`,
      })));
    }
  }
  const cycleMessage = request.rentalUnit
    ? `${requiredDepositAmount > 0 ? 'Security deposit verified and agreement approved.' : 'Agreement approved.'} The rent workflow is now started. The initial room rent invoice is due ${dueAt.toLocaleDateString('en-IN', { dateStyle: 'long' })}.`
    : ACTIVE_CYCLE_AGREEMENT_TYPES.has(request.agreementType)
      ? `${request.agreementType === 'lease' ? 'Lease' : 'Rent'} cycle started. Due date: ${dueAt.toLocaleDateString('en-IN', { dateStyle: 'long' })}; term: ${termMonths} month${termMonths === 1 ? '' : 's'}.`
    : 'Sale agreement approved. The completed stamp-paper agreement is ready to download.';
  await createNotification({
    user: request.tenant?._id || request.tenant,
    title: 'Agreement approved',
    message: cycleMessage,
    category: 'lease',
    actionUrl: tenancy?._id
      ? `/app/my-property/${tenancy._id}/rent-cycle`
      : `/app/my-applications?record=${request.application?._id || request.application}`,
    metadata: { agreementRequest: request._id, tenancy: tenancy?._id || null, rentalUnit: request.rentalUnit?._id || request.rentalUnit || null, agreementType: request.agreementType, cycleStartedAt: startsAt, cycleEndsAt: endsAt, occupancyPending: Boolean(request.rentalUnit), securityDepositPaid: requiredDepositAmount > 0 },
  });
  await writeAudit(req, { action: 'first-party-approved-agreement', module: 'agreement-requests', recordId: request._id, previousValue, updatedValue: request.toObject() });
  res.json({ success: true, data: requestPayload(request, tenancy), message: cycleMessage });
});

export const renewAgreementCycle = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  const status = visibleRequestStatus(request);
  if (status !== 'approved' || !ACTIVE_CYCLE_AGREEMENT_TYPES.has(request.agreementType)) {
    throw new ApiError(409, 'Renewal is available only for an approved rent or lease agreement');
  }
  const firstParty = sameId(request.landlord, req.user._id) && isAgreementManager(req.user);
  const secondParty = sameId(request.tenant, req.user._id);
  if (!firstParty && !secondParty) throw new ApiError(403, 'Agreement renewal access denied');
  if (firstParty) throw new ApiError(409, 'Prepare a new renewal agreement with its term and dates. The signed agreement remains unchanged.');

  const previousValue = request.toObject();
  const now = new Date();
  if (request.renewalRequestedAt) return res.json({ success: true, data: requestPayload(request, await tenancyForAgreement(request)), message: 'Your renewal request is already waiting for the first party.' });
  request.renewalRequestedAt = now;
  request.renewalRequestedBy = req.user._id;
  request.updatedBy = req.user._id;
  await request.save();
  await createNotification({
    user: request.landlord?._id || request.landlord,
    title: 'Rent / lease renewal requested',
    message: `${request.tenantName || 'The second party'} requested renewal of the ${request.agreementType} cycle.`,
    category: 'lease',
    actionUrl: `/app/application_details/${request.application?._id || request.application}`,
    metadata: { agreementRequest: request._id, renewalRequested: true },
  });
  await writeAudit(req, { action: 'second-party-renewal-requested', module: 'agreement-requests', recordId: request._id, previousValue, updatedValue: request.toObject() });
  res.json({ success: true, data: requestPayload(request, await tenancyForAgreement(request)), message: 'Renewal requested from the landlord-enabled first party.' });
});

export const requestAgreementCancellation = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  if (!sameId(request.tenant, req.user._id)) throw new ApiError(403, 'Only the applicant tenant can request cancellation');
  if (visibleRequestStatus(request) !== 'approved' || !ACTIVE_CYCLE_AGREEMENT_TYPES.has(request.agreementType)) {
    throw new ApiError(409, 'Cancellation can be requested only for an approved rent or lease cycle');
  }
  if (request.cancellationResolution === 'requested') return res.json({ success: true, data: requestPayload(request, await tenancyForAgreement(request)), message: 'Your cancellation request is already waiting for the first party.' });
  const previousValue = request.toObject();
  request.cancellationRequestedAt = new Date();
  request.cancellationRequestedBy = req.user._id;
  request.cancellationReason = cleanText(req.body?.reason).slice(0, 1200);
  request.cancellationResolution = 'requested';
  request.updatedBy = req.user._id;
  await request.save();
  await createNotification({
    user: request.landlord?._id || request.landlord,
    title: 'Tenant requested cycle cancellation',
    message: `${request.tenantName || 'The second party'} requested cancellation of the active ${request.agreementType} cycle.`,
    category: 'lease',
    actionUrl: `/app/applications?record=${request.application?._id || request.application}`,
    metadata: { agreementRequest: request._id, cancellationRequested: true },
  });
  await writeAudit(req, { action: 'second-party-cancellation-requested', module: 'agreement-requests', recordId: request._id, previousValue, updatedValue: request.toObject() });
  res.json({ success: true, data: requestPayload(request, await tenancyForAgreement(request)), message: 'Cancellation request sent to the landlord-enabled first party.' });
});

export const rejectAgreementCancellation = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  assertFirstParty(request, req.user, 'Only the landlord-enabled first party can respond to this cancellation request');
  if (visibleRequestStatus(request) !== 'approved' || request.cancellationResolution !== 'requested') {
    throw new ApiError(409, 'There is no pending cancellation request to keep open');
  }
  const previousValue = request.toObject();
  request.cancellationResolution = 'rejected';
  request.cancellationResolvedAt = new Date();
  request.cancellationResolvedBy = req.user._id;
  request.updatedBy = req.user._id;
  await request.save();
  await createNotification({
    user: request.tenant?._id || request.tenant,
    title: 'Cancellation request not approved',
    message: `The landlord-enabled first party kept the ${request.agreementType} cycle active.`,
    category: 'lease',
    actionUrl: `/app/my-applications?record=${request.application?._id || request.application}`,
    metadata: { agreementRequest: request._id, cancellationRejected: true },
  });
  await writeAudit(req, { action: 'first-party-rejected-cancellation', module: 'agreement-requests', recordId: request._id, previousValue, updatedValue: request.toObject() });
  res.json({ success: true, data: requestPayload(request, await tenancyForAgreement(request)), message: 'The cancellation request was declined and the cycle remains active.' });
});

export const cancelAgreementCycle = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  assertFirstParty(request, req.user, 'Only the landlord-enabled first party can cancel this cycle');
  if (visibleRequestStatus(request) !== 'approved' || !ACTIVE_CYCLE_AGREEMENT_TYPES.has(request.agreementType)) {
    throw new ApiError(409, 'Only an active approved rent or lease cycle can be cancelled');
  }
  if (request.rentalUnit) {
    throw new ApiError(409, 'Room tenancies must use the notice, inspection, final payment and deposit-settlement workflow before closure');
  }
  const previousValue = request.toObject();
  const now = new Date();
  const tenancy = await tenancyForAgreement(request);
  if (tenancy) {
    tenancy.status = 'cancelled';
    tenancy.endDate = now;
    tenancy.updatedBy = req.user._id;
    await tenancy.save();
  }
  await releaseCycleProperty(request, req.user._id);
  request.status = 'cancelled';
  request.cancelledAt = now;
  request.cancelledBy = req.user._id;
  request.cancellationResolution = 'cancelled';
  request.cancellationResolvedAt = now;
  request.cancellationResolvedBy = req.user._id;
  request.updatedBy = req.user._id;
  await request.save();
  await createNotification({
    user: request.tenant?._id || request.tenant,
    title: 'Rent / lease cycle cancelled',
    message: `The landlord-enabled first party cancelled the ${request.agreementType} cycle.`,
    category: 'lease',
    actionUrl: `/app/my-applications?record=${request.application?._id || request.application}`,
    metadata: { agreementRequest: request._id, tenancy: tenancy?._id || null, cycleCancelled: true },
  });
  await writeAudit(req, { action: 'first-party-cancelled-cycle', module: 'agreement-requests', recordId: request._id, previousValue, updatedValue: request.toObject() });
  res.json({ success: true, data: requestPayload(request, tenancy), message: 'The rent / lease cycle was cancelled.' });
});

export const closeAgreementCycle = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  assertFirstParty(request, req.user, 'Only the landlord-enabled first party can close this cycle');
  if (visibleRequestStatus(request) !== 'approved' || !ACTIVE_CYCLE_AGREEMENT_TYPES.has(request.agreementType)) {
    throw new ApiError(409, 'Only an active approved rent or lease cycle can be closed');
  }
  if (request.rentalUnit) {
    const roomTenancy = await tenancyForAgreement(request);
    if (!roomTenancy || roomTenancy.status !== 'closed') {
      throw new ApiError(409, 'Close the room tenancy through move-out inspection, final payment and deposit settlement first');
    }
  }
  const now = new Date();
  const endsAt = validDate(request.cycleEndsAt);
  if (endsAt && endsAt.getTime() > now.getTime()) {
    throw new ApiError(409, 'This cycle has not reached its end date. Use Cancel cycle for an early termination.');
  }
  const previousValue = request.toObject();
  const tenancy = await tenancyForAgreement(request);
  if (tenancy) {
    tenancy.status = request.rentalUnit ? 'closed' : 'completed';
    tenancy.endDate ||= now;
    tenancy.updatedBy = req.user._id;
    await tenancy.save();
  }
  await releaseCycleProperty(request, req.user._id);
  request.status = 'closed';
  request.closedAt = now;
  request.closedBy = req.user._id;
  request.updatedBy = req.user._id;
  await request.save();
  await createNotification({
    user: request.tenant?._id || request.tenant,
    title: 'Rent / lease cycle closed',
    message: `The completed ${request.agreementType} cycle was closed by the landlord-enabled first party.`,
    category: 'lease',
    actionUrl: `/app/my-applications?record=${request.application?._id || request.application}`,
    metadata: { agreementRequest: request._id, tenancy: tenancy?._id || null, cycleClosed: true },
  });
  await writeAudit(req, { action: 'first-party-closed-cycle', module: 'agreement-requests', recordId: request._id, previousValue, updatedValue: request.toObject() });
  res.json({ success: true, data: requestPayload(request, tenancy), message: 'The completed rent / lease cycle was closed.' });
});

export const listAgreementRequests = asyncHandler(async (req, res) => {
  const administrator = String(req.user?.role || '').toLowerCase() === 'admin';
  const filter = administrator
    ? {}
    : { $or: [
      { landlord: req.user._id },
      { tenant: req.user._id, status: { $nin: ['draft', 'first_party_signed', 'configuration_required'] } },
    ] };
  if (req.query.application && mongoose.isValidObjectId(req.query.application)) filter.application = req.query.application;
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',').filter((item) => REQUEST_ACCESS_STATUSES.has(item)) };
  const rows = await AgreementRequest.find(filter)
    .populate('application', 'applicationNumber status')
    .populate('property', 'title purpose listingType address pricing')
    .populate('space', 'name roomNumber flatNumber apartmentNumber')
    .populate('rentalUnit', 'name roomNumber pricing')
    .populate('securityDepositPayment')
    .populate('template', 'name title agreementType version')
    .populate('landlord', 'name email')
    .populate('tenant', 'name email')
    .sort({ createdAt: -1 }).lean();
  const tenancyIds = rows.map((item) => item.tenancy).filter((id) => mongoose.isValidObjectId(id));
  const applicationIds = rows.map((item) => item.application?._id || item.application).filter((id) => mongoose.isValidObjectId(id));
  const tenancies = tenancyIds.length || applicationIds.length
    ? await Tenancy.find({
      $or: [
        ...(tenancyIds.length ? [{ _id: { $in: tenancyIds } }] : []),
        ...(applicationIds.length ? [{ application: { $in: applicationIds } }] : []),
      ],
    }).lean()
    : [];
  const tenancyById = new Map(tenancies.map((item) => [String(item._id), item]));
  const tenancyByApplication = new Map(tenancies.map((item) => [String(item.application || ''), item]));
  const data = rows.map((item) => requestPayload(
    item,
    tenancyById.get(String(item.tenancy || '')) || tenancyByApplication.get(String(item.application?._id || item.application || '')) || null,
  ));
  res.json({ success: true, data });
});

export const previewAgreementRequest = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  if (sameId(request.tenant, req.user._id) && request.status === 'sent') {
    request.status = 'viewed';
    request.viewedAt ||= new Date();
    request.updatedBy = req.user._id;
    await request.save();
  }
  const pdf = await createStampPaperPdf({
    title: request.renderedTitle,
    body: request.renderedBody,
    stampPaper: normalizeStampPaper(request.stampPaper),
    agreementType: request.agreementType,
    landlordName: request.landlordName,
    tenantName: request.tenantName,
    firstPartyMark: request.firstPartyMark,
    secondPartySignature: request.secondPartySignature,
    approvalStatus: visibleRequestStatus(request),
    approvedAt: request.firstPartyApprovalAt,
    durationMonths: request.durationMonths || request.cycleTermMonths,
    startDate: request.startDate,
    endDate: request.endDate,
    cycleStartedAt: request.cycleStartedAt,
    cycleEndsAt: request.cycleEndsAt,
  });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(stampFileName(request))}`);
  res.send(pdf);
});

export const getAgreementPartyMark = asyncHandler(async (req, res) => {
  const request = await requestForParticipant(req.params.id, req.user);
  const party = String(req.params.party || '').trim().toLowerCase();
  const mark = party === 'first-party' ? request.firstPartyMark : party === 'second-party' ? request.secondPartySignature : null;
  if (!mark || !hasMark(mark)) throw new ApiError(404, 'This party mark has not been uploaded');
  const file = await DriveFile.findOne({ _id: markFileId(mark), status: { $ne: 'trashed' } }).select('+storageKey');
  if (!file?.storageKey) throw new ApiError(404, 'Signature or stamp/seal file not found');
  const buffer = await readBuffer(file.storageDriver, file.storageKey);
  if (!isTransparentPng(buffer)) throw new ApiError(409, 'The stored signature is not a valid transparent PNG');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', INTERNAL_MARK_MIME);
  res.setHeader('Content-Disposition', 'inline');
  res.send(buffer);
});
