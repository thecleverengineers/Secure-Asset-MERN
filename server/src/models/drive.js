import mongoose from 'mongoose';
import { TENANT_KYC_DOCUMENT_CATEGORIES } from '../constants/tenantKyc.js';

const { Schema, model, models } = mongoose;
const ref = (name, required = false) => ({ type: Schema.Types.ObjectId, ref: name, required });
const timestamps = { timestamps: true };

const publicLinkSchema = new Schema({
  enabled: { type: Boolean, default: false },
  tokenHash: { type: String, select: false },
  slug: { type: String, trim: true, lowercase: true },
  passwordHash: { type: String, select: false },
  startsAt: Date,
  expiresAt: Date,
  allowDownload: { type: Boolean, default: true },
  allowPreview: { type: Boolean, default: true },
  allowUpload: { type: Boolean, default: false },
  maxViews: Number,
  maxDownloads: Number,
  views: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
  allowedEmails: [String],
  allowedDomains: [String],
  allowedCountries: [String],
  watermark: { enabled: Boolean, text: String, dynamicRecipient: Boolean },
  regeneratedAt: Date,
  revokedAt: Date,
}, { _id: false });

const DriveFolderSchema = new Schema({
  owner: { ...ref('User', true), index: true },
  parent: { ...ref('DriveFolder'), default: null, index: true },
  ancestors: [{ ...ref('DriveFolder'), index: true }],
  name: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, default: '', maxlength: 2000 },
  icon: { type: String, default: 'folder' },
  color: { type: String, default: '#0B5270' },
  coverImage: String,
  category: { type: String, enum: ['general', 'legal', 'property', 'survey', 'images', 'videos', 'audio', 'agreements', 'reports', 'receipts', 'archive', 'trash'], default: 'general', index: true },
  visibility: { type: String, enum: ['private', 'selected_users', 'team', 'restricted_link', 'public'], default: 'private', index: true },
  inheritanceMode: { type: String, enum: ['folder_only', 'include_existing', 'inherit', 'manual'], default: 'manual' },
  status: { type: String, enum: ['active', 'archived', 'trashed'], default: 'active', index: true },
  starred: { type: Boolean, default: false, index: true },
  systemKey: { type: String, default: null, index: true },
  sensitive: { type: Boolean, default: false },
  branding: { logo: String, contact: String, primaryColor: String, layout: { type: String, enum: ['grid', 'list'], default: 'grid' } },
  publicLink: publicLinkSchema,
  deletedAt: Date,
  purgeAt: { type: Date },
  createdBy: ref('User'),
  updatedBy: ref('User'),
}, timestamps);
DriveFolderSchema.index({ name: 'text', description: 'text' }, { name: 'drive_folder_search_text', weights: { name: 10, description: 2 } });
DriveFolderSchema.index({ owner: 1, parent: 1, name: 1, status: 1 });
DriveFolderSchema.index({ 'publicLink.slug': 1 }, { unique: true, sparse: true });
// Retention is processed by the PM2 purge worker so storage objects and audit records are cleaned consistently.
DriveFolderSchema.index({ status: 1, purgeAt: 1 });

const DriveFileSchema = new Schema({
  owner: { ...ref('User', true), index: true },
  folder: { ...ref('DriveFolder'), default: null, index: true },
  name: { type: String, required: true, trim: true, maxlength: 255 },
  originalName: String,
  description: { type: String, default: '', maxlength: 5000 },
  extension: { type: String, lowercase: true, index: true },
  mimeType: { type: String, required: true, index: true },
  category: { type: String, enum: ['document', 'image', 'video', 'audio', 'property', 'survey', 'compressed', 'legal', 'other', ...TENANT_KYC_DOCUMENT_CATEGORIES], default: 'other', index: true },
  // Server-derived classification for the protected smart document
  // taxonomy. It is intentionally separate from the user-editable tags so
  // quick-access counts and searches remain reliable.
  smartFolderKey: { type: String, index: true },
  documentType: { type: String, trim: true, maxlength: 180 },
  storageDriver: { type: String, enum: ['local', 's3'], default: 'local' },
  storageKey: { type: String, required: true, select: false },
  sizeBytes: { type: Number, required: true, min: 0 },
  checksum: { type: String, required: true, index: true },
  currentVersion: { type: Number, default: 1 },
  status: { type: String, enum: ['active', 'archived', 'trashed', 'quarantined'], default: 'active', index: true },
  visibility: { type: String, enum: ['private', 'selected_users', 'team', 'restricted_link', 'public'], default: 'private', index: true },
  confidentiality: { type: String, enum: ['normal', 'private', 'confidential', 'highly_confidential', 'legal_record', 'identity_document', 'financial_document'], default: 'private', index: true },
  starred: { type: Boolean, default: false, index: true },
  locked: { type: Boolean, default: false },
  immutable: { type: Boolean, default: false },
  tags: [{ type: String, trim: true, lowercase: true, index: true }],
  internalNotes: String,
  extractedText: { type: String, select: false },
  expiresAt: Date,
  reminderAt: Date,
  approval: {
    status: { type: String, enum: ['draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'final', 'archived'], default: 'draft', index: true },
    requestedBy: ref('User'), reviewedBy: ref('User'), reason: String, requestedAt: Date, reviewedAt: Date,
  },
  legalMetadata: {
    documentType: String, referenceNumber: String, jurisdiction: String,
    issueDate: Date, effectiveDate: Date, expiryDate: Date, registrationDate: Date,
    registrationNumber: String, signatureStatus: String, stampDutyStatus: String,
    verificationStatus: String, confidentialityLevel: String, legalReviewStatus: String,
    relatedParties: [{ type: String }],
  },
  relations: {
    property: ref('Property'), user: ref('User'), surveyProject: ref('SurveyProject'),
    agreement: ref('Lease'), dispute: Schema.Types.ObjectId, legalMatter: Schema.Types.ObjectId,
  },
  publicLink: publicLinkSchema,
  preview: { status: { type: String, enum: ['pending', 'ready', 'unsupported', 'failed'], default: 'pending' }, thumbnailKey: { type: String, select: false }, pageCount: Number },
  deletedAt: Date,
  purgeAt: { type: Date },
  createdBy: ref('User'),
  updatedBy: ref('User'),
}, timestamps);
DriveFileSchema.index({ name: 'text', description: 'text', extractedText: 'text', tags: 'text', originalName: 'text' }, { name: 'drive_file_search_text', weights: { name: 10, originalName: 8, tags: 6, description: 3, extractedText: 1 } });
DriveFileSchema.index({ owner: 1, folder: 1, status: 1, updatedAt: -1 });
DriveFileSchema.index({ owner: 1, checksum: 1, sizeBytes: 1 });
DriveFileSchema.index({ 'publicLink.slug': 1 }, { unique: true, sparse: true });
// Do not use MongoDB TTL here: TTL deletion would orphan encrypted/S3 objects and bypass legal-retention checks.
DriveFileSchema.index({ status: 1, purgeAt: 1 });

const DriveFileVersionSchema = new Schema({
  file: { ...ref('DriveFile', true), index: true },
  owner: { ...ref('User', true), index: true },
  version: { type: Number, required: true },
  storageDriver: { type: String, enum: ['local', 's3'], default: 'local' },
  storageKey: { type: String, required: true, select: false },
  sizeBytes: Number,
  checksum: String,
  mimeType: String,
  changeDescription: String,
  approvalStatus: String,
  signatureStatus: String,
  immutable: { type: Boolean, default: false },
  uploadedBy: ref('User'),
}, timestamps);
DriveFileVersionSchema.index({ file: 1, version: 1 }, { unique: true });

const DriveShareSchema = new Schema({
  owner: { ...ref('User', true), index: true },
  itemType: { type: String, enum: ['file', 'folder'], required: true, index: true },
  itemId: { type: Schema.Types.ObjectId, required: true, index: true },
  granteeUser: { ...ref('User'), index: true },
  granteeEmail: { type: String, lowercase: true, trim: true, index: true },
  teamKey: { type: String, index: true },
  permission: { type: String, enum: ['viewer', 'commenter', 'downloader', 'uploader', 'editor', 'manager', 'co_owner'], default: 'viewer' },
  capabilities: {
    view: { type: Boolean, default: true }, preview: { type: Boolean, default: true }, download: Boolean,
    comment: Boolean, upload: Boolean, editMetadata: Boolean, rename: Boolean, move: Boolean,
    delete: Boolean, reshare: Boolean, managePermissions: Boolean,
  },
  expiresAt: Date,
  revokedAt: Date,
  acceptedAt: Date,
  createdBy: ref('User'),
}, timestamps);
DriveShareSchema.index({ itemType: 1, itemId: 1, granteeUser: 1, granteeEmail: 1 }, { unique: true, sparse: true });

const DriveActivitySchema = new Schema({
  owner: { ...ref('User'), index: true },
  actor: { ...ref('User'), index: true },
  itemType: { type: String, enum: ['file', 'folder', 'share', 'upload', 'system'], required: true },
  itemId: Schema.Types.ObjectId,
  action: { type: String, required: true, index: true },
  sharingMethod: String,
  ip: String,
  device: String,
  country: String,
  metadata: Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } });
DriveActivitySchema.index({ owner: 1, createdAt: -1 });
DriveActivitySchema.index({ itemType: 1, itemId: 1, createdAt: -1 });

const DriveCommentSchema = new Schema({
  file: { ...ref('DriveFile', true), index: true },
  user: { ...ref('User', true), index: true },
  parent: ref('DriveComment'),
  body: { type: String, required: true, maxlength: 5000 },
  mentions: [ref('User')],
  resolvedAt: Date,
  resolvedBy: ref('User'),
}, timestamps);

const DriveUsageSchema = new Schema({
  user: { ...ref('User', true), unique: true, index: true },
  usedBytes: { type: Number, default: 0, min: 0 },
  trashBytes: { type: Number, default: 0, min: 0 },
  byCategory: { documents: { type: Number, default: 0 }, images: { type: Number, default: 0 }, videos: { type: Number, default: 0 }, audio: { type: Number, default: 0 }, other: { type: Number, default: 0 } },
  lastRecalculatedAt: Date,
}, timestamps);

const DriveUploadSessionSchema = new Schema({
  user: { ...ref('User', true), index: true },
  folder: ref('DriveFolder'),
  filename: String,
  mimeType: String,
  totalBytes: Number,
  chunkSize: Number,
  totalChunks: Number,
  receivedChunks: [{ type: Number }],
  tempKey: { type: String, select: false },
  metadata: Schema.Types.Mixed,
  status: { type: String, enum: ['initiated', 'uploading', 'completed', 'cancelled', 'expired'], default: 'initiated', index: true },
  expiresAt: { type: Date, required: true },
}, timestamps);
DriveUploadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });


const DrivePolicySchema = new Schema({
  key: { type: String, default: 'default', unique: true },
  maxFileMb: { type: Number, default: 250, min: 1, max: 10240 },
  allowedExtensions: [{ type: String, lowercase: true }],
  trashRetentionDays: { type: Number, default: 60, min: 1, max: 3650 },
  legalRetentionDays: { type: Number, default: 2555, min: 1 },
  publicSharingEnabled: { type: Boolean, default: true },
  legalPublicSharingEnabled: { type: Boolean, default: true },
  maxPublicLinkDays: { type: Number, default: 365, min: 1 },
  malwareScanRequired: { type: Boolean, default: false },
  updatedBy: ref('User'),
}, timestamps);

const DriveContentReportSchema = new Schema({
  reporter: ref('User'),
  itemType: { type: String, enum: ['file', 'folder'], required: true },
  itemId: { type: Schema.Types.ObjectId, required: true, index: true },
  reason: { type: String, enum: ['personal_information', 'copyright', 'fraud', 'illegal', 'misleading', 'malware', 'inappropriate', 'confidential_exposure', 'other'], required: true },
  details: String,
  status: { type: String, enum: ['submitted', 'under_review', 'restricted', 'dismissed', 'resolved'], default: 'submitted', index: true },
  reviewedBy: ref('User'),
  decision: String,
}, timestamps);

export const DriveFolder = models.DriveFolder || model('DriveFolder', DriveFolderSchema);
export const DriveFile = models.DriveFile || model('DriveFile', DriveFileSchema);
export const DriveFileVersion = models.DriveFileVersion || model('DriveFileVersion', DriveFileVersionSchema);
export const DriveShare = models.DriveShare || model('DriveShare', DriveShareSchema);
export const DriveActivity = models.DriveActivity || model('DriveActivity', DriveActivitySchema);
export const DriveComment = models.DriveComment || model('DriveComment', DriveCommentSchema);
export const DriveUsage = models.DriveUsage || model('DriveUsage', DriveUsageSchema);
export const DriveUploadSession = models.DriveUploadSession || model('DriveUploadSession', DriveUploadSessionSchema);
export const DriveContentReport = models.DriveContentReport || model('DriveContentReport', DriveContentReportSchema);
export const DrivePolicy = models.DrivePolicy || model('DrivePolicy', DrivePolicySchema);
