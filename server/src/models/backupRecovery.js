import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;
const ref = (name, required = false) => ({ type: Schema.Types.ObjectId, ref: name, required });

const BackupArtifactSchema = new Schema({
  fileName: { type: String, trim: true, maxlength: 180 },
  relativePath: { type: String, select: false },
  deletedAt: Date,
  sizeBytes: { type: Number, min: 0, default: 0 },
  sha256: { type: String, trim: true, lowercase: true, maxlength: 128 },
  manifestSha256: { type: String, trim: true, lowercase: true, maxlength: 128 },
  encryption: {
    algorithm: { type: String, default: 'aes-256-gcm' },
    format: { type: String, default: 'secureasset-backup-v1' },
    keyVersion: { type: String, default: 'v1' },
  },
  components: {
    databaseBytes: { type: Number, min: 0, default: 0 },
    vaultDataBytes: { type: Number, min: 0, default: 0 },
    sourceBytes: { type: Number, min: 0, default: 0 },
  },
}, { _id: false });

const RestoreControlSchema = new Schema({
  status: { type: String, enum: ['not_requested', 'requested', 'in_progress', 'completed', 'failed', 'expired'], default: 'not_requested', index: true },
  requestedBy: ref('User'),
  requestedAt: Date,
  confirmationHash: { type: String, select: false },
  expiresAt: Date,
  consumedAt: Date,
  completedAt: Date,
  components: [{ type: String, enum: ['database', 'vault', 'source'] }],
  error: { type: String, maxlength: 1000 },
}, { _id: false });

const SystemBackupSchema = new Schema({
  backupNumber: { type: String, required: true, trim: true, unique: true, index: true, maxlength: 96 },
  trigger: { type: String, enum: ['manual', 'scheduled', 'pre_restore'], default: 'manual', index: true },
  label: { type: String, trim: true, maxlength: 240 },
  scheduleKey: { type: String, trim: true, unique: true, sparse: true, index: true, maxlength: 80 },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed', 'expired'], default: 'queued', index: true },
  requestedBy: ref('User'),
  startedAt: Date,
  completedAt: Date,
  retentionUntil: { type: Date, index: true },
  attempt: { type: Number, min: 0, default: 0 },
  releaseId: { type: String, trim: true, maxlength: 160 },
  artifact: { type: BackupArtifactSchema, default: () => ({}) },
  restore: { type: RestoreControlSchema, default: () => ({}) },
  error: { type: String, maxlength: 1200 },
}, { timestamps: true });

SystemBackupSchema.index({ status: 1, createdAt: -1 }, { name: 'system_backup_status_created' });
SystemBackupSchema.index({ retentionUntil: 1, status: 1 }, { name: 'system_backup_retention' });
SystemBackupSchema.index({ 'restore.status': 1, 'restore.expiresAt': 1 }, { name: 'system_backup_restore_control' });

export const SystemBackup = models.SystemBackup || model('SystemBackup', SystemBackupSchema);
