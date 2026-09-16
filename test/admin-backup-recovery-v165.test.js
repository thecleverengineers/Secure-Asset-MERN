import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v165 encrypts retained MongoDB, uploaded-data, and source recovery points', () => {
  const service = read('server/src/services/backupRecovery.js');
  const model = read('server/src/models/backupRecovery.js');
  const env = read('server/src/config/env.js');

  for (const phrase of ['aes-256-gcm', "Buffer.from('SABK1')", 'mongodump', 'createDataArchive', 'createSourceArchive', 'enforceBackupRetention', 'createRestoreAuthorization', 'materializeRestore']) assert.ok(service.includes(phrase), `missing backup protection: ${phrase}`);
  assert.match(service, /BACKUP_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes/);
  assert.match(service, /retentionUntil/);
  assert.match(model, /unique: true/);
  assert.match(model, /confirmationHash: \{ type: String, select: false \}/);
  for (const key of ['BACKUP_STORAGE_DIR', 'BACKUP_TEMP_DIR', 'BACKUP_RETENTION_DAYS', 'BACKUP_CRON', 'BACKUP_TIMEZONE']) assert.ok(env.includes(key), `missing production backup environment key: ${key}`);
});

test('v165 permits only admins to create backups and authorise a two-factor root-side restore', () => {
  const routes = read('server/src/routes/backupRecoveryRoutes.js');
  const controller = read('server/src/controllers/backupRecoveryController.js');
  const app = read('server/src/app.js');
  const page = read('src/app/pages/app/BackupRecoveryPage.tsx');

  assert.match(routes, /router\.use\(authenticate, authorize\('admin'\)\)/);
  assert.match(app, /app\.use\('\/api\/v1\/backup-recovery', backupRecoveryRoutes\)/);
  for (const phrase of ['RESTORE ${backup.backupNumber}', 'comparePassword', 'verifyRestoreSecondFactor', 'restore-token', 'secureasset-backup-restore.sh']) assert.ok(controller.includes(phrase), `missing controlled restore safeguard: ${phrase}`);
  for (const phrase of ['Create backup', 'Controlled restore', 'Authenticator 2FA is mandatory', 'Laptop recovery copy']) assert.ok(page.includes(phrase), `missing administrator recovery UI: ${phrase}`);
});

test('v165 schedules daily protection and provides an offline-friendly restricted laptop pull', () => {
  const ecosystem = read('ecosystem.config.cjs');
  const deploy = read('scripts/deploy-production.sh');
  const sftpSetup = read('scripts/setup-laptop-backup-pull.sh');
  const laptopPull = read('scripts/laptop-backup-pull.sh');
  const laptopTimer = read('scripts/install-laptop-backup-pull-timer.sh');

  assert.match(ecosystem, /name: 'secureasset-backup-automation'/);
  assert.match(ecosystem, /cron_restart: process\.env\.BACKUP_CRON \|\| '0 17 \* \* \*'/);
  assert.match(deploy, /install_mongodb_tools_if_needed/);
  assert.match(deploy, /BACKUP_STORAGE_DIR/);
  for (const phrase of ['ChrootDirectory /var/lib/secureasset', 'ForceCommand internal-sftp', 'PasswordAuthentication no', 'AllowTcpForwarding no']) assert.ok(sftpSetup.includes(phrase), `missing SFTP restriction: ${phrase}`);
  for (const phrase of ['StrictHostKeyChecking=yes', 'sha256_file', '/backup-pull/archives']) assert.ok(laptopPull.includes(phrase), `missing verified pull guard: ${phrase}`);
  assert.match(laptopTimer, /Persistent=true/);
  assert.match(laptopTimer, /OnCalendar=\*-\*-\* 17:20:00/);
});
