import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;
const objectId = (ref, required = false) => ({ type: Schema.Types.ObjectId, ref, required });

export const AGREEMENT_TYPES = Object.freeze(['rent', 'lease', 'sale']);
export const AGREEMENT_REQUEST_STATUSES = Object.freeze([
  // `configuration_required` is retained only so existing DocuSign records
  // remain readable after the move to the internal two-party workflow.
  'draft', 'first_party_signed', 'configuration_required', 'sent', 'viewed',
  // `signed` is retained for records created before the first-party approval
  // gate. New internal-signature records use `awaiting_first_party_approval`
  // after the applicant uploads their mark, then `approved` once the first
  // party verifies it and starts the tenancy cycle.
  'awaiting_first_party_approval', 'approved', 'signed',
  'cancelled', 'closed', 'declined', 'voided', 'expired',
]);

const StampPaperSchema = new Schema({
  enabled: { type: Boolean, default: true },
  state: { type: String, trim: true, maxlength: 120, default: '' },
  denomination: { type: Number, min: 0, default: 0 },
  series: { type: String, trim: true, maxlength: 80, default: '' },
  paperSize: { type: String, enum: ['A4', 'A3', 'Letter'], default: 'A4' },
}, { _id: false });

// The source image is normalised to a transparent PNG in the browser before
// upload. The file itself stays in the encrypted drive; this record stores
// only immutable, auditable metadata and the private DriveFile reference.
const PartyMarkSchema = new Schema({
  file: { ...objectId('DriveFile', true) },
  kind: { type: String, enum: ['signature', 'stamp_seal'], required: true },
  name: { type: String, trim: true, maxlength: 255 },
  mimeType: { type: String, enum: ['image/png'], default: 'image/png' },
  checksum: { type: String, maxlength: 128 },
  backgroundRemoved: { type: Boolean, default: true },
  uploadedAt: { type: Date, default: Date.now },
  signedBy: objectId('User'),
}, { _id: false });

const AgreementRenewalSchema = new Schema({
  requestedAt: { type: Date, default: Date.now },
  requestedBy: objectId('User'),
  approvedAt: Date,
  approvedBy: objectId('User'),
  cycleStartedAt: Date,
  cycleEndsAt: Date,
}, { _id: false });

const AgreementTemplateSchema = new Schema({
  owner: { ...objectId('User', true), index: true },
  key: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  agreementType: { type: String, enum: AGREEMENT_TYPES, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  body: { type: String, required: true, trim: true, maxlength: 40000 },
  stampPaper: { type: StampPaperSchema, default: () => ({ enabled: true }) },
  active: { type: Boolean, default: true, index: true },
  version: { type: Number, min: 1, default: 1 },
  createdBy: objectId('User'),
  updatedBy: objectId('User'),
}, { timestamps: true });
AgreementTemplateSchema.index({ owner: 1, key: 1 }, { unique: true, name: 'agreement_template_owner_key_unique' });
AgreementTemplateSchema.index({ owner: 1, agreementType: 1, active: 1 }, { name: 'agreement_template_owner_type_active' });

const AgreementRequestSchema = new Schema({
  application: { ...objectId('Application', true), index: true },
  property: { ...objectId('Property', true), index: true },
  space: objectId('PropertySpace'),
  rentalUnit: { ...objectId('RentalUnit'), index: true },
  landlord: { ...objectId('User', true), index: true },
  tenant: { ...objectId('User', true), index: true },
  template: { ...objectId('AgreementTemplate', true) },
  agreementType: { type: String, enum: AGREEMENT_TYPES, required: true, index: true },
  status: { type: String, enum: AGREEMENT_REQUEST_STATUSES, default: 'draft', index: true },
  // New agreements are signed in SecureAsset. Keep `docusign` accepted for
  // historic records so the migration never invalidates existing data.
  provider: { type: String, enum: ['internal_signature', 'docusign'], default: 'internal_signature' },
  providerEnvelopeId: { type: String, index: true, sparse: true },
  stampPaper: { type: StampPaperSchema, default: () => ({ enabled: true }) },
  renderedTitle: { type: String, maxlength: 240 },
  renderedBody: { type: String, maxlength: 50000 },
  tenantName: { type: String, trim: true, maxlength: 160 },
  tenantEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
  landlordName: { type: String, trim: true, maxlength: 160 },
  landlordEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
  // First party = the landlord-enabled tenant who owns/manages the property.
  // Second party = the tenant who submitted the accepted application.
  firstPartyMark: { type: PartyMarkSchema, default: undefined },
  secondPartySignature: { type: PartyMarkSchema, default: undefined },
  firstPartySignedAt: Date,
  secondPartyAcceptedAt: Date,
  secondPartySignedAt: Date,
  // The first party must verify the applicant's uploaded signature before a
  // rent or lease becomes active. This is deliberately separate from the
  // first-party mark upload, which happens before the request is sent.
  firstPartyVerificationAt: Date,
  firstPartyVerifiedBy: objectId('User'),
  firstPartyApprovalAt: Date,
  firstPartyApprovedBy: objectId('User'),
  firstPartyVerificationNote: { type: String, trim: true, maxlength: 1200, default: '' },
  // Rent/lease lifecycle. Sale agreements retain the completed paper but do
  // not create a tenancy or recurring rental cycle.
  tenancy: { ...objectId('Tenancy'), index: true },
  renewalOf: { ...objectId('AgreementRequest'), index: true },
  durationMonths: { type: Number, min: 1 },
  startDate: Date,
  endDate: Date,
  cycleStartedAt: Date,
  cycleEndsAt: Date,
  nextDueAt: Date,
  // A tenant-specific Fast2SMS rent reminder is queued once when seven
  // calendar days remain in an active rent cycle. The key includes the cycle
  // end date so an approved renewal receives its own reminder without a
  // duplicate for the prior cycle.
  rentCycleReminder: {
    key: { type: String, trim: true, maxlength: 220 },
    cycleEndsAt: Date,
    dueAt: Date,
    status: { type: String, enum: ['processing', 'queued', 'failed'] },
    attemptedAt: Date,
    queuedAt: Date,
    lastError: { type: String, maxlength: 500, default: '' },
  },
  cycleTermMonths: { type: Number, min: 1 },
  renewalRequestedAt: Date,
  renewalRequestedBy: objectId('User'),
  renewalHistory: { type: [AgreementRenewalSchema], default: [] },
  cancellationRequestedAt: Date,
  cancellationRequestedBy: objectId('User'),
  cancellationReason: { type: String, trim: true, maxlength: 1200, default: '' },
  cancellationResolvedAt: Date,
  cancellationResolvedBy: objectId('User'),
  cancellationResolution: { type: String, enum: ['none', 'requested', 'cancelled', 'rejected'], default: 'none' },
  cancelledAt: Date,
  cancelledBy: objectId('User'),
  closedAt: Date,
  closedBy: objectId('User'),
  sentAt: Date,
  viewedAt: Date,
  signedAt: Date,
  declinedAt: Date,
  expiresAt: Date,
  lastError: { type: String, maxlength: 2000, default: '' },
  createdBy: objectId('User'),
  updatedBy: objectId('User'),
}, { timestamps: true });
AgreementRequestSchema.index({ application: 1, createdAt: -1 }, { name: 'agreement_request_application_recent' });
AgreementRequestSchema.index({ tenant: 1, status: 1, createdAt: -1 }, { name: 'agreement_request_tenant_status' });
AgreementRequestSchema.index({ landlord: 1, status: 1, createdAt: -1 }, { name: 'agreement_request_landlord_status' });

export const AgreementTemplate = models.AgreementTemplate || model('AgreementTemplate', AgreementTemplateSchema);
export const AgreementRequest = models.AgreementRequest || model('AgreementRequest', AgreementRequestSchema);
