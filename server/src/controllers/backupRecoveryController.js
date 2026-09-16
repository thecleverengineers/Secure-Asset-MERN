import crypto from 'node:crypto';
import { z } from 'zod';
import { AuditLog, SystemBackup, User } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { consumeBackupCode, decryptTwoFactorSecret, verifyTotp } from '../services/twoFactor.js';
import { createNotification } from '../services/notifications.js';
import {
  backupSummary, backupSystemStatus, createRestoreAuthorization, queueSystemBackup,
} from '../services/backupRecovery.js';

const createSchema = z.object({ reason: z.string().trim().max(240).optional() }).strict();
const restoreSchema = z.object({
  confirmation: z.string().trim().max(160),
  currentPassword: z.string().min(8).max(128),
  twoFactorCode: z.string().trim().min(6).max(32),
  components: z.array(z.enum(['database', 'vault', 'source'])).min(1).max(3),
}).strict();

function backupId(value) {
  if (!/^[a-f\d]{24}$/i.test(String(value || ''))) throw new ApiError(422, 'Invalid backup identifier');
  return String(value);
}

async function verifyRestoreSecondFactor(user, code) {
  if (!user?.twoFactor?.enabled || !user.twoFactor.secretEncrypted) return false;
  const input = String(code || '').trim();
  try {
    if (verifyTotp(decryptTwoFactorSecret(user.twoFactor.secretEncrypted), input)) return true;
  } catch { return false; }
  const consumed = consumeBackupCode(user.twoFactor.backupCodeHashes || [], input);
  if (!consumed.valid) return false;
  user.twoFactor.backupCodeHashes = consumed.remaining;
  await user.save({ validateModifiedOnly: true });
  return true;
}

function restoreCommand(backupNumber, token, components) {
  const componentList = components.join(',');
  return `sudo APP_DIR=/www/secureasset bash /www/secureasset/scripts/secureasset-backup-restore.sh --backup-id ${backupNumber} --restore-token ${token} --components ${componentList} --apply`;
}

export const getBackupRecoveryOverview = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await backupSystemStatus() });
});

export const listSystemBackups = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const rows = await SystemBackup.find().sort({ createdAt: -1 }).limit(limit)
    .populate('requestedBy', 'name email role').populate('restore.requestedBy', 'name email role').lean();
  res.json({ success: true, data: rows.map(backupSummary) });
});

export const createSystemBackup = asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) throw new ApiError(422, 'Backup reason is invalid');
  const backup = await queueSystemBackup({ trigger: 'manual', requestedBy: req.user._id, label: parsed.data.reason || 'Admin requested encrypted backup' });
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'backup:queued', module: 'backup-recovery', recordId: backup._id,
    updatedValue: { backupNumber: backup.backupNumber, trigger: backup.trigger, label: backup.label }, ip: req.ip, device: req.get('user-agent'),
  });
  const appDirectory = process.env.APP_DIR || process.cwd();
  const child = crypto.randomUUID();
  const { spawn } = await import('node:child_process');
  const worker = spawn(process.execPath, ['scripts/run-system-backup.js', '--backup', backup.backupNumber], {
    cwd: appDirectory, detached: true, stdio: 'ignore', shell: false,
    env: { ...process.env, APP_DIR: appDirectory, SECUREASSET_BACKUP_WORKER_ID: child },
  });
  worker.unref();
  res.status(202).json({ success: true, data: backupSummary(backup), message: 'Encrypted backup queued. It will include MongoDB, uploaded vault/data, and the application source.' });
});

export const requestSystemRestore = asyncHandler(async (req, res) => {
  const parsed = restoreSchema.safeParse(req.body || {});
  if (!parsed.success) throw new ApiError(422, 'Enter the exact confirmation, current password, authenticator code, and one or more recovery components');
  const backup = await SystemBackup.findOne({ _id: backupId(req.params.backupId), status: 'completed', retentionUntil: { $gt: new Date() } });
  if (!backup) throw new ApiError(404, 'This encrypted backup is unavailable or has expired');
  const expectedConfirmation = `RESTORE ${backup.backupNumber}`;
  if (parsed.data.confirmation !== expectedConfirmation) throw new ApiError(422, `Confirmation must exactly match: ${expectedConfirmation}`);
  const operator = await User.findById(req.user._id).select('+password +twoFactor.secretEncrypted +twoFactor.backupCodeHashes');
  if (!operator || !(await operator.comparePassword(parsed.data.currentPassword))) throw new ApiError(401, 'Current password is invalid');
  if (!operator.twoFactor?.enabled) throw new ApiError(409, 'Authenticator 2FA is required before authorising a system restore');
  if (!await verifyRestoreSecondFactor(operator, parsed.data.twoFactorCode)) throw new ApiError(401, 'Authenticator or backup code is invalid');
  const authorization = await createRestoreAuthorization({ backup, userId: req.user._id, components: parsed.data.components });
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'backup:restore-authorised', module: 'backup-recovery', recordId: backup._id,
    updatedValue: { backupNumber: backup.backupNumber, components: authorization.components, expiresAt: authorization.expiresAt }, ip: req.ip, device: req.get('user-agent'),
  });
  const peerAdmins = await User.find({ role: 'admin', status: 'active', _id: { $ne: req.user._id } }).select('_id').lean();
  await Promise.all(peerAdmins.map((admin) => createNotification({
    user: admin._id, title: 'System restore authorised',
    message: `${req.user.name || 'An administrator'} authorised a controlled restore from ${backup.backupNumber}. The root-side recovery command expires in 15 minutes.`,
    category: 'system', actionUrl: '/app/backup-recovery', metadata: { event: 'backup_restore_authorised', backupNumber: backup.backupNumber },
  })));
  res.json({
    success: true,
    data: {
      backup: backupSummary(backup), expiresAt: authorization.expiresAt, components: authorization.components,
      command: restoreCommand(backup.backupNumber, authorization.token, authorization.components),
    },
    message: 'Restore authorised. Run the one-time root-side command before it expires; the browser cannot directly overwrite production data.',
  });
});
