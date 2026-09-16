import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { env } from '../config/env.js';
import { AuditLog, SystemBackup } from '../models/index.js';

const BACKUP_MAGIC = Buffer.from('SABK1');
const BACKUP_IV_BYTES = 12;
const BACKUP_TAG_BYTES = 16;
const BACKUP_HEADER_BYTES = BACKUP_MAGIC.length + BACKUP_IV_BYTES;
const BACKUP_FILE_PATTERN = /^secureasset-backup-[A-Z0-9-]+\.sba$/;
const BACKUP_NUMBER_PATTERN = /^SAB-[0-9]{8}-[0-9]{6}-[A-Z0-9]{8}$/;
const RESTORE_COMPONENTS = new Set(['database', 'vault', 'source']);

function appRoot() { return path.resolve(process.env.APP_DIR || process.cwd()); }
function inside(parent, candidate) {
  const root = path.resolve(parent);
  const target = path.resolve(candidate);
  return target !== root && target.startsWith(`${root}${path.sep}`);
}
function safeError(error) {
  const message = String(error?.message || error || 'Backup operation failed')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, 'MongoDB connection')
    .replace(/(password|secret|token)=([^\s&]+)/gi, '$1=[redacted]');
  return message.slice(0, 1100);
}
function backupKey() {
  const key = Buffer.from(String(env.BACKUP_ENCRYPTION_KEY_BASE64 || ''), 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes');
  return key;
}
function isoStamp(now = new Date()) {
  const values = [
    now.getUTCFullYear(), String(now.getUTCMonth() + 1).padStart(2, '0'), String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'), String(now.getUTCMinutes()).padStart(2, '0'), String(now.getUTCSeconds()).padStart(2, '0'),
  ];
  return `${values[0]}${values[1]}${values[2]}-${values[3]}${values[4]}${values[5]}`;
}
function newBackupNumber(now = new Date()) { return `SAB-${isoStamp(now)}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; }
function backupFileName(number) {
  if (!BACKUP_NUMBER_PATTERN.test(String(number || ''))) throw new Error('Invalid backup identifier');
  return `secureasset-backup-${number}.sba`;
}
function artifactPath(number) {
  const candidate = path.resolve(env.BACKUP_STORAGE_DIR, backupFileName(number));
  if (!inside(env.BACKUP_STORAGE_DIR, candidate)) throw new Error('Unsafe backup artifact path');
  return candidate;
}
function backupTempRoot() { return path.resolve(env.BACKUP_TEMP_DIR); }
function assertSafeStageDirectory(directory) {
  const target = path.resolve(directory);
  if (!inside(backupTempRoot(), target)) throw new Error('Restore staging directory must be inside BACKUP_TEMP_DIR');
  return target;
}
function fileExists(file) { return fsp.stat(file).then(() => true).catch(() => false); }
async function directoryExists(directory) {
  try { return (await fsp.stat(directory)).isDirectory(); } catch { return false; }
}

async function hashFile(file) {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest('hex');
}
async function fileDetails(file) {
  const stat = await fsp.stat(file);
  return { sizeBytes: stat.size, sha256: await hashFile(file) };
}
async function writePrivateJson(file, value) {
  const target = path.resolve(file);
  await fsp.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fsp.chmod(target, 0o600);
}
async function runCommand(command, args, { cwd = appRoot(), timeoutMs = 60 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let stdout = ''; let stderr = ''; let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000).unref();
    }, timeoutMs);
    timer.unref();
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      error ? reject(error) : resolve(value);
    };
    child.stdout.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-8192); });
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8192); });
    child.once('error', (error) => finish(new Error(`${command} is unavailable: ${safeError(error)}`)));
    child.once('close', (code, signal) => {
      if (code === 0) return finish(null, { stdout, stderr });
      return finish(new Error(`${command} failed${signal ? ` (${signal})` : ` (exit ${code})`}: ${safeError(stderr || stdout || 'no diagnostic output')}`));
    });
  });
}
async function removeSafeTemporary(directory) {
  if (!directory || !inside(backupTempRoot(), directory)) return;
  await fsp.rm(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 150 }).catch(() => {});
}
async function releaseId() {
  try { return (await fsp.readFile(path.join(appRoot(), 'RELEASE_ID'), 'utf8')).trim().slice(0, 160); } catch { return 'unknown'; }
}
function localDateForTimeZone(now = new Date(), timeZone = env.BACKUP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const values = Object.fromEntries(parts.filter((part) => ['year', 'month', 'day'].includes(part.type)).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function lookupExecutable(command) {
  return String(process.env.PATH || '').split(path.delimiter).some((entry) => {
    try { return fs.statSync(path.join(entry, command)).isFile(); } catch { return false; }
  });
}

export async function ensureBackupDirectories() {
  await fsp.mkdir(env.BACKUP_STORAGE_DIR, { recursive: true, mode: 0o2750 });
  await fsp.mkdir(env.BACKUP_TEMP_DIR, { recursive: true, mode: 0o700 });
  // Keep the setgid bit so the optional restricted SFTP pull account can
  // read newly-created encrypted artifacts without being able to decrypt
  // them or obtain a server shell.
  await fsp.chmod(env.BACKUP_STORAGE_DIR, 0o2750).catch(() => {});
  await fsp.chmod(env.BACKUP_TEMP_DIR, 0o700).catch(() => {});
}

async function createDataArchive(archivePath, stageDirectory) {
  const tarPath = archivePath.replace(/\.gz$/i, '');
  const sources = [
    { key: 'vault', path: env.VAULT_STORAGE_DIR },
    { key: 'site-assets', path: env.CMS_ASSET_DIR },
    { key: 'legacy-uploads', path: env.UPLOAD_DIR },
  ];
  const included = [];
  let created = false;
  for (const source of sources) {
    if (!await directoryExists(source.path)) continue;
    const args = [created ? '-rf' : '-cf', tarPath, `--transform=s|^|${source.key}/|`, '-C', path.resolve(source.path), '.'];
    await runCommand('tar', args);
    included.push(source.key);
    created = true;
  }
  if (!created) {
    const marker = path.join(stageDirectory, 'no-uploaded-data.txt');
    await fsp.writeFile(marker, 'No configured uploaded-data directory existed when this backup was created.\n', { mode: 0o600 });
    await runCommand('tar', ['-cf', tarPath, '-C', stageDirectory, path.basename(marker)]);
  }
  await runCommand('gzip', ['-9', '-f', tarPath]);
  return included;
}

async function createSourceArchive(archivePath) {
  const excluded = [
    '.env', '.env.*', 'node_modules', 'node_modules/*', 'dist', 'dist/*', 'logs', 'logs/*', 'backups', 'backups/*',
    '.frontend-releases', '.frontend-releases/*', 'storage', 'storage/*', 'uploads', 'uploads/*', 'public/uploads', 'public/uploads/*',
    'server/src/uploads', 'server/src/uploads/*',
  ];
  await runCommand('tar', ['-czf', archivePath, ...excluded.map((item) => `--exclude=${item}`), '-C', appRoot(), '.']);
}

async function createBundle(stageDirectory, entries) {
  const bundle = path.join(stageDirectory, 'secureasset-backup.bundle.tar');
  await runCommand('tar', ['-cf', bundle, '-C', stageDirectory, ...entries]);
  return bundle;
}

async function encryptBundle(input, output) {
  const key = backupKey();
  const iv = crypto.randomBytes(BACKUP_IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const writer = fs.createWriteStream(output, { flags: 'wx', mode: 0o640 });
  await new Promise((resolve, reject) => writer.write(Buffer.concat([BACKUP_MAGIC, iv]), (error) => error ? reject(error) : resolve()));
  try {
    await pipeline(fs.createReadStream(input), cipher, writer, { end: false });
    const tag = cipher.getAuthTag();
    await new Promise((resolve, reject) => writer.end(tag, (error) => error ? reject(error) : resolve()));
  } catch (error) {
    writer.destroy();
    throw error;
  }
  await fsp.chmod(output, 0o640);
}

async function decryptBundle(input, output) {
  const stat = await fsp.stat(input);
  if (stat.size <= BACKUP_HEADER_BYTES + BACKUP_TAG_BYTES) throw new Error('Encrypted backup is truncated');
  const handle = await fsp.open(input, 'r');
  const header = Buffer.alloc(BACKUP_HEADER_BYTES); const tag = Buffer.alloc(BACKUP_TAG_BYTES);
  try {
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, tag.length, stat.size - BACKUP_TAG_BYTES);
  } finally { await handle.close(); }
  if (!header.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)) throw new Error('Unsupported encrypted backup format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', backupKey(), header.subarray(BACKUP_MAGIC.length));
  decipher.setAuthTag(tag);
  await pipeline(
    fs.createReadStream(input, { start: BACKUP_HEADER_BYTES, end: stat.size - BACKUP_TAG_BYTES - 1 }),
    decipher,
    fs.createWriteStream(output, { flags: 'wx', mode: 0o600 }),
  );
}

function componentRecord(name, detail) { return { name, ...detail }; }
async function buildManifest({ backup, stageDirectory, databaseArchive, dataArchive, sourceArchive, includedDataSources }) {
  const components = await Promise.all([
    fileDetails(databaseArchive).then((value) => componentRecord('database.archive.gz', value)),
    fileDetails(dataArchive).then((value) => componentRecord('uploaded-data.tar.gz', value)),
    fileDetails(sourceArchive).then((value) => componentRecord('application-source.tar.gz', value)),
  ]);
  const manifest = {
    format: 'secureasset-backup-v1',
    backupNumber: backup.backupNumber,
    createdAt: new Date().toISOString(),
    releaseId: await releaseId(),
    dataSources: includedDataSources,
    components,
  };
  const manifestPath = path.join(stageDirectory, 'manifest.json');
  await writePrivateJson(manifestPath, manifest);
  return { manifest, manifestPath };
}

async function validateMaterializedBackup(stageDirectory) {
  const manifestPath = path.join(stageDirectory, 'manifest.json');
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  if (manifest?.format !== 'secureasset-backup-v1' || !BACKUP_NUMBER_PATTERN.test(String(manifest?.backupNumber || ''))) throw new Error('Backup manifest is invalid');
  const expected = new Map((manifest.components || []).map((item) => [item.name, item]));
  for (const fileName of ['database.archive.gz', 'uploaded-data.tar.gz', 'application-source.tar.gz']) {
    const entry = expected.get(fileName);
    const file = path.join(stageDirectory, fileName);
    if (!entry || !await fileExists(file)) throw new Error(`Backup manifest is missing ${fileName}`);
    const detail = await fileDetails(file);
    if (detail.sizeBytes !== Number(entry.sizeBytes) || detail.sha256 !== entry.sha256) throw new Error(`Integrity verification failed for ${fileName}`);
  }
  return manifest;
}

function restoreTokenHash(token) { return crypto.createHmac('sha256', backupKey()).update(String(token || '')).digest('hex'); }
function tokenMatches(expected, provided) {
  if (!expected || !provided || String(expected).length !== restoreTokenHash(provided).length) return false;
  return crypto.timingSafeEqual(Buffer.from(String(expected)), Buffer.from(restoreTokenHash(provided)));
}

export function backupSummary(record) {
  const item = record?.toObject ? record.toObject() : record || {};
  return {
    _id: item._id,
    backupNumber: item.backupNumber,
    trigger: item.trigger,
    label: item.label || '',
    status: item.status,
    requestedBy: item.requestedBy,
    startedAt: item.startedAt || null,
    completedAt: item.completedAt || null,
    retentionUntil: item.retentionUntil || null,
    attempt: Number(item.attempt || 0),
    releaseId: item.releaseId || '',
    artifact: item.artifact ? {
      fileName: item.artifact.fileName || '', sizeBytes: Number(item.artifact.sizeBytes || 0), sha256: item.artifact.sha256 || '',
      manifestSha256: item.artifact.manifestSha256 || '', encryption: item.artifact.encryption || {}, components: item.artifact.components || {},
    } : {},
    restore: item.restore ? {
      status: item.restore.status || 'not_requested', requestedBy: item.restore.requestedBy || null, requestedAt: item.restore.requestedAt || null,
      expiresAt: item.restore.expiresAt || null, consumedAt: item.restore.consumedAt || null, completedAt: item.restore.completedAt || null,
      components: item.restore.components || [], error: item.restore.error || '',
    } : { status: 'not_requested' },
    error: item.error || '', createdAt: item.createdAt || null, updatedAt: item.updatedAt || null,
  };
}

export async function queueSystemBackup({ trigger = 'manual', requestedBy = null, label = '', scheduleKey = null } = {}) {
  const now = new Date();
  const retentionUntil = new Date(now.getTime() + Number(env.BACKUP_RETENTION_DAYS) * 86400000);
  const record = { backupNumber: newBackupNumber(now), trigger, requestedBy, label: String(label || '').trim().slice(0, 240), scheduleKey: scheduleKey || undefined, retentionUntil, releaseId: await releaseId() };
  try { return await SystemBackup.create(record); } catch (error) {
    if (error?.code === 11000 && scheduleKey) return SystemBackup.findOne({ scheduleKey });
    throw error;
  }
}

export async function queueScheduledSystemBackup(now = new Date()) {
  return queueSystemBackup({ trigger: 'scheduled', scheduleKey: `daily-${localDateForTimeZone(now)}`, label: `Daily ${env.BACKUP_TIMEZONE} backup` });
}

async function writeBackupIndex() {
  await ensureBackupDirectories();
  const now = new Date();
  const backups = await SystemBackup.find({ status: 'completed', retentionUntil: { $gt: now }, 'artifact.fileName': { $type: 'string' } })
    .sort({ completedAt: -1 }).limit(500).lean();
  const items = backups.map((record) => ({
    backupNumber: record.backupNumber, fileName: record.artifact?.fileName, sizeBytes: Number(record.artifact?.sizeBytes || 0),
    sha256: record.artifact?.sha256 || '', createdAt: record.completedAt || record.createdAt, retentionUntil: record.retentionUntil,
    format: record.artifact?.encryption?.format || 'secureasset-backup-v1', keyVersion: record.artifact?.encryption?.keyVersion || 'v1',
  })).filter((item) => BACKUP_FILE_PATTERN.test(String(item.fileName || '')));
  const indexPath = path.join(env.BACKUP_STORAGE_DIR, 'backup-index.json');
  const tempPath = path.join(env.BACKUP_STORAGE_DIR, `.backup-index-${process.pid}-${crypto.randomUUID()}.tmp`);
  await writePrivateJson(tempPath, { format: 'secureasset-backup-index-v1', generatedAt: now.toISOString(), items });
  await fsp.rename(tempPath, indexPath);
  await fsp.chmod(indexPath, 0o640).catch(() => {});
}

export async function enforceBackupRetention() {
  const now = new Date();
  const expired = await SystemBackup.find({ status: 'completed', retentionUntil: { $lte: now } }).select('backupNumber artifact requestedBy').limit(500);
  let removed = 0;
  for (const record of expired) {
    const file = artifactPath(record.backupNumber);
    await fsp.unlink(file).catch((error) => { if (error?.code !== 'ENOENT') throw error; });
    record.status = 'expired';
    record.artifact = { ...(record.artifact?.toObject?.() || record.artifact || {}), deletedAt: now };
    await record.save({ validateModifiedOnly: true });
    await AuditLog.create({ role: 'system', action: 'backup:retention-expired', module: 'backup-recovery', recordId: record._id, updatedValue: { backupNumber: record.backupNumber, expiredAt: now } });
    removed += 1;
  }
  await writeBackupIndex();
  return { removed };
}

async function claimBackup(backupNumber = '') {
  const running = await SystemBackup.exists({ status: 'running' });
  if (running) return null;
  const filter = backupNumber ? { backupNumber, status: 'queued' } : { status: 'queued' };
  const query = SystemBackup.findOneAndUpdate(filter, { $set: { status: 'running', startedAt: new Date(), error: '' }, $inc: { attempt: 1 } }, { new: true });
  if (!backupNumber) query.sort({ createdAt: 1 });
  return query;
}

export async function runQueuedSystemBackup(backupNumber = '') {
  const backup = await claimBackup(backupNumber);
  if (!backup) return { started: false, reason: 'Another encrypted backup is already running or this job is no longer queued' };
  let stageDirectory = '';
  let artifact = '';
  try {
    await ensureBackupDirectories();
    if (!lookupExecutable('mongodump')) throw new Error('mongodump is required for encrypted database backups. Install MongoDB Database Tools before running this job.');
    if (!lookupExecutable('tar') || !lookupExecutable('gzip')) throw new Error('tar and gzip are required for encrypted backup packaging.');
    stageDirectory = await fsp.mkdtemp(path.join(backupTempRoot(), 'secureasset-backup-'));
    await fsp.chmod(stageDirectory, 0o700);
    const databaseArchive = path.join(stageDirectory, 'database.archive.gz');
    const dataArchive = path.join(stageDirectory, 'uploaded-data.tar.gz');
    const sourceArchive = path.join(stageDirectory, 'application-source.tar.gz');
    await runCommand('mongodump', [`--uri=${env.MONGODB_URI}`, `--archive=${databaseArchive}`, '--gzip'], { timeoutMs: 4 * 60 * 60 * 1000 });
    const includedDataSources = await createDataArchive(dataArchive, stageDirectory);
    await createSourceArchive(sourceArchive);
    const { manifest, manifestPath } = await buildManifest({ backup, stageDirectory, databaseArchive, dataArchive, sourceArchive, includedDataSources });
    const bundle = await createBundle(stageDirectory, [path.basename(manifestPath), path.basename(databaseArchive), path.basename(dataArchive), path.basename(sourceArchive)]);
    artifact = artifactPath(backup.backupNumber);
    await encryptBundle(bundle, artifact);
    const [artifactDetail, manifestDetail, dbDetail, dataDetail, sourceDetail] = await Promise.all([
      fileDetails(artifact), fileDetails(manifestPath), fileDetails(databaseArchive), fileDetails(dataArchive), fileDetails(sourceArchive),
    ]);
    backup.status = 'completed'; backup.completedAt = new Date(); backup.releaseId = manifest.releaseId;
    backup.artifact = {
      fileName: path.basename(artifact), relativePath: path.basename(artifact), sizeBytes: artifactDetail.sizeBytes, sha256: artifactDetail.sha256,
      manifestSha256: manifestDetail.sha256, encryption: { algorithm: 'aes-256-gcm', format: 'secureasset-backup-v1', keyVersion: 'v1' },
      components: { databaseBytes: dbDetail.sizeBytes, vaultDataBytes: dataDetail.sizeBytes, sourceBytes: sourceDetail.sizeBytes },
    };
    await backup.save();
    await AuditLog.create({ role: 'system', action: 'backup:created', module: 'backup-recovery', recordId: backup._id, updatedValue: { backupNumber: backup.backupNumber, trigger: backup.trigger, sizeBytes: artifactDetail.sizeBytes, sha256: artifactDetail.sha256, dataSources: includedDataSources } });
    const retention = await enforceBackupRetention();
    return { started: true, completed: true, backup: backupSummary(backup), retention };
  } catch (error) {
    if (artifact && inside(env.BACKUP_STORAGE_DIR, artifact)) await fsp.unlink(artifact).catch(() => {});
    backup.status = 'failed'; backup.error = safeError(error); backup.completedAt = new Date();
    await backup.save({ validateModifiedOnly: true });
    await AuditLog.create({ role: 'system', action: 'backup:failed', module: 'backup-recovery', recordId: backup._id, updatedValue: { backupNumber: backup.backupNumber, trigger: backup.trigger, error: backup.error } });
    throw error;
  } finally {
    await removeSafeTemporary(stageDirectory);
  }
}

export async function backupSystemStatus() {
  const [latest, queued, running, completed] = await Promise.all([
    SystemBackup.findOne().sort({ createdAt: -1 }).lean(), SystemBackup.countDocuments({ status: 'queued' }), SystemBackup.countDocuments({ status: 'running' }), SystemBackup.countDocuments({ status: 'completed' }),
  ]);
  let legacyBackupCount = 0;
  try { legacyBackupCount = (await fsp.readdir(path.join(appRoot(), 'backups'))).filter((name) => /\.(archive\.gz|tar\.gz|zip)$/i.test(name)).length; } catch { /* no legacy directory yet */ }
  return {
    schedule: { cron: env.BACKUP_CRON, timeZone: env.BACKUP_TIMEZONE, label: 'Every day at 5:00 PM' },
    retentionDays: Number(env.BACKUP_RETENTION_DAYS), encryption: { algorithm: 'AES-256-GCM', configured: Boolean(env.BACKUP_ENCRYPTION_KEY_BASE64) },
    tooling: { mongodump: lookupExecutable('mongodump'), mongorestore: lookupExecutable('mongorestore'), tar: lookupExecutable('tar'), gzip: lookupExecutable('gzip'), rsync: lookupExecutable('rsync') },
    queue: { queued, running, completed }, latest: latest ? backupSummary(latest) : null,
    existingBackupData: { legacyFilesPreserved: legacyBackupCount, message: legacyBackupCount ? 'Existing legacy deployment backups remain untouched; new managed backups are encrypted separately.' : 'No legacy deployment backup archive was detected.' },
  };
}

export async function createRestoreAuthorization({ backup, userId, components }) {
  const selected = [...new Set((components || []).map((item) => String(item).toLowerCase()).filter((item) => RESTORE_COMPONENTS.has(item)))];
  if (!selected.length) throw new Error('Choose at least one recovery component');
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date(); const expiresAt = new Date(now.getTime() + Number(env.BACKUP_RESTORE_TOKEN_TTL_MINUTES) * 60 * 1000);
  backup.restore = {
    status: 'requested', requestedBy: userId, requestedAt: now, confirmationHash: restoreTokenHash(token), expiresAt,
    components: selected, error: '',
  };
  await backup.save();
  return { token, expiresAt, components: selected };
}

export async function materializeRestore({ backupNumber, token, stageDirectory, consume = false }) {
  if (!BACKUP_NUMBER_PATTERN.test(String(backupNumber || ''))) throw new Error('Invalid backup identifier');
  const stage = assertSafeStageDirectory(stageDirectory);
  const backup = await SystemBackup.findOne({ backupNumber, status: 'completed' }).select('+artifact.relativePath +restore.confirmationHash');
  if (!backup) throw new Error('Completed encrypted backup was not found');
  if (backup.restore?.status !== 'requested' || !backup.restore?.expiresAt || backup.restore.expiresAt <= new Date()) throw new Error('Restore authorization is missing or has expired');
  if (!tokenMatches(backup.restore.confirmationHash, token)) throw new Error('Restore authorization is invalid');
  const artifact = artifactPath(backup.backupNumber);
  if (!await fileExists(artifact)) throw new Error('Encrypted backup artifact is no longer available on this server');
  await fsp.mkdir(stage, { recursive: true, mode: 0o700 });
  const bundle = path.join(stage, 'secureasset-backup.bundle.tar');
  await decryptBundle(artifact, bundle);
  await runCommand('tar', ['-xf', bundle, '-C', stage]);
  const manifest = await validateMaterializedBackup(stage);
  if (manifest.backupNumber !== backup.backupNumber) throw new Error('Backup identity mismatch');
  if (consume) {
    backup.restore.status = 'in_progress'; backup.restore.consumedAt = new Date(); backup.restore.error = '';
    await backup.save({ validateModifiedOnly: true });
  }
  return { backup, manifest, stageDirectory: stage };
}

export async function markRestoreResult(backupNumber, { success, error = '' } = {}) {
  const backup = await SystemBackup.findOne({ backupNumber }).select('+restore.confirmationHash');
  if (!backup) return null;
  backup.restore.status = success ? 'completed' : 'failed'; backup.restore.completedAt = new Date(); backup.restore.error = success ? '' : safeError(error);
  backup.restore.confirmationHash = undefined;
  await backup.save({ validateModifiedOnly: true });
  await AuditLog.create({ role: 'system', action: success ? 'backup:restore-completed' : 'backup:restore-failed', module: 'backup-recovery', recordId: backup._id, updatedValue: { backupNumber, components: backup.restore.components || [], error: backup.restore.error || undefined } });
  return backup;
}
