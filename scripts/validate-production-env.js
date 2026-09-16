import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.env.APP_DIR || process.cwd(), '.env');
if (!fs.existsSync(file)) {
  console.error('Missing .env. Copy .env.production.example to .env and configure it first.');
  process.exit(1);
}

const values = {};
for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#') || !line.includes('=')) continue;
  const index = line.indexOf('=');
  values[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
}

const errors = [];
const warnings = [];
const placeholder = (value = '') => !value || /GENERATE_|CHANGE_THIS|USER:PASSWORD|CLUSTER|example\.com|change-this/i.test(value);
const requireValue = (key) => { if (placeholder(values[key])) errors.push(`${key} is missing or still contains a placeholder.`); };
const bool = (value) => ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(String(value || '').toLowerCase());

for (const key of ['MONGODB_URI', 'CLIENT_URL', 'PUBLIC_APP_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) requireValue(key);
if ((values.JWT_ACCESS_SECRET || '').length < 64) errors.push('JWT_ACCESS_SECRET must contain at least 64 characters.');
if ((values.JWT_REFRESH_SECRET || '').length < 64) errors.push('JWT_REFRESH_SECRET must contain at least 64 characters.');
if (values.JWT_ACCESS_SECRET && values.JWT_ACCESS_SECRET === values.JWT_REFRESH_SECRET) errors.push('JWT access and refresh secrets must be different.');
if (placeholder(values.ENCRYPTION_MASTER_KEY_BASE64)) {
  errors.push('ENCRYPTION_MASTER_KEY_BASE64 is missing or still contains a placeholder.');
} else {
  try {
    const decoded = Buffer.from(values.ENCRYPTION_MASTER_KEY_BASE64, 'base64');
    if (decoded.length !== 32) errors.push('ENCRYPTION_MASTER_KEY_BASE64 must decode to exactly 32 bytes.');
  } catch {
    errors.push('ENCRYPTION_MASTER_KEY_BASE64 must be valid Base64.');
  }
}
if (placeholder(values.BACKUP_ENCRYPTION_KEY_BASE64)) {
  errors.push('BACKUP_ENCRYPTION_KEY_BASE64 is missing or still contains a placeholder.');
} else {
  try {
    const decoded = Buffer.from(values.BACKUP_ENCRYPTION_KEY_BASE64, 'base64');
    if (decoded.length !== 32) errors.push('BACKUP_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes.');
  } catch {
    errors.push('BACKUP_ENCRYPTION_KEY_BASE64 must be valid Base64.');
  }
}

for (const key of ['CLIENT_URL', 'PUBLIC_APP_URL']) {
  if (!placeholder(values[key])) {
    for (const value of values[key].split(',').map((item) => item.trim()).filter(Boolean)) {
      try { new URL(value); } catch { errors.push(`${key} contains an invalid absolute URL: ${value}`); }
    }
  }
}

const apiBase = String(values.VITE_API_URL || '').trim();
if (!apiBase) {
  errors.push('VITE_API_URL is required. Use /api/v1 for the standard same-origin deployment.');
} else if (apiBase.startsWith('/')) {
  if (!/^\/api\/v1\/?$/i.test(apiBase)) errors.push('VITE_API_URL must be /api/v1 for the standard same-origin deployment.');
} else {
  try {
    const url = new URL(apiBase);
    const publicHost = new URL(values.PUBLIC_APP_URL).hostname;
    const localApiHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase());
    const publicIsLocal = ['localhost', '127.0.0.1', '::1'].includes(publicHost.toLowerCase());
    if (localApiHost && !publicIsLocal) errors.push('VITE_API_URL cannot point to localhost for a public deployment. Use /api/v1.');
    if (!/\/api\/v1\/?$/i.test(url.pathname)) errors.push('An absolute VITE_API_URL must end with /api/v1.');
  } catch {
    errors.push('VITE_API_URL must be /api/v1 or a valid absolute URL ending with /api/v1.');
  }
}

const storageDriver = (values.STORAGE_DRIVER || 'local').toLowerCase();
if (storageDriver === 'local') {
  if ((values.VAULT_ENCRYPTION_KEY || '').length < 64) errors.push('VAULT_ENCRYPTION_KEY must contain at least 64 characters for local encrypted storage.');
  requireValue('VAULT_STORAGE_DIR');
  requireValue('VAULT_TEMP_DIR');
} else if (storageDriver === 's3') {
  requireValue('S3_REGION');
  requireValue('S3_BUCKET');
  const hasAccessKey = Boolean(values.S3_ACCESS_KEY_ID);
  const hasSecretKey = Boolean(values.S3_SECRET_ACCESS_KEY);
  if (hasAccessKey !== hasSecretKey) errors.push('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must both be set or both be empty.');
  if (!hasAccessKey) warnings.push('S3 static credentials are empty; deployment will use the AWS SDK default credential provider chain (for example an IAM role).');
  if ((values.S3_SSE || 'AES256') === 'aws:kms' && !values.S3_KMS_KEY_ID) errors.push('S3_KMS_KEY_ID is required when S3_SSE=aws:kms.');
} else {
  errors.push('STORAGE_DRIVER must be local or s3.');
}
requireValue('BACKUP_STORAGE_DIR');
requireValue('BACKUP_TEMP_DIR');

if (values.NODE_ENV !== 'production') errors.push('NODE_ENV must be production.');
const port = Number(values.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be between 1 and 65535.');
for (const key of ['REFRESH_TOKEN_TTL_DAYS', 'SESSION_ROLLING_TTL_DAYS', 'SESSION_ABSOLUTE_TTL_DAYS', 'SESSION_RENEWAL_WINDOW_HOURS', 'SESSION_ROTATION_GRACE_SECONDS', 'VAULT_MAX_FILE_MB', 'VAULT_CHUNK_MB', 'TRASH_RETENTION_DAYS']) {
  const value = Number(values[key]);
  if (!Number.isFinite(value) || value <= 0) errors.push(`${key} must be a positive number.`);
}
if (Number(values.SESSION_ROLLING_TTL_DAYS) < 30 || Number(values.SESSION_ROLLING_TTL_DAYS) > 90) errors.push('SESSION_ROLLING_TTL_DAYS must be between 30 and 90.');
if (Number(values.SESSION_ABSOLUTE_TTL_DAYS) < Number(values.SESSION_ROLLING_TTL_DAYS)) errors.push('SESSION_ABSOLUTE_TTL_DAYS must be greater than or equal to SESSION_ROLLING_TTL_DAYS.');
if (Number(values.SESSION_RENEWAL_WINDOW_HOURS) > Number(values.SESSION_ROLLING_TTL_DAYS) * 24) errors.push('SESSION_RENEWAL_WINDOW_HOURS cannot exceed the rolling session lifetime.');
for (const key of ['LEGACY_PUBLIC_UPLOADS', 'CLAMAV_ENABLED', 'SMTP_SECURE', 'SMTP_REQUIRE_TLS', 'SMTP_TLS_REJECT_UNAUTHORIZED', 'PAYMENT_AUTO_APPROVE', 'S3_FORCE_PATH_STYLE', 'AUTO_DB_MIGRATIONS', 'SEED_DEMO_RENTAL_DATA']) {
  if (values[key] !== undefined && !bool(values[key])) errors.push(`${key} must be true or false.`);
}
if (String(values.LEGACY_PUBLIC_UPLOADS).toLowerCase() === 'true') errors.push('LEGACY_PUBLIC_UPLOADS must be false in production.');
if (String(values.PAYMENT_AUTO_APPROVE).toLowerCase() === 'true') errors.push('PAYMENT_AUTO_APPROVE must be false in production.');

for (const [key, min, max] of [
  ['AUTO_DB_MIGRATION_LOCK_TTL_MS', 60000, 86400000],
  ['AUTO_DB_MIGRATION_WAIT_MS', 10000, 86400000],
  ['AUTO_DB_MIGRATION_POLL_MS', 500, 60000],
  ['BACKUP_RETENTION_DAYS', 7, 3650],
  ['BACKUP_RESTORE_TOKEN_TTL_MINUTES', 5, 60],
]) {
  const value = Number(values[key]);
  if (!Number.isInteger(value) || value < min || value > max) errors.push(`${key} must be an integer between ${min} and ${max}.`);
}

const cronExpression = (value) => {
  const fields = String(value || '').trim().split(/\s+/);
  return fields.length === 5 && fields.every((field) => /^[0-9*/?,-]+$/.test(field));
};
for (const key of ['VAULT_PURGE_CRON', 'RENT_AUTOMATION_CRON', 'NOTIFICATION_DELIVERY_CRON', 'BACKUP_CRON']) {
  if (!cronExpression(values[key])) {
    const shown = values[key] === undefined || values[key] === '' ? '(missing)' : JSON.stringify(values[key]);
    errors.push(`${key} must be a valid five-field cron expression. Received: ${shown}.`);
  }
}
try { new Intl.DateTimeFormat('en-CA', { timeZone: values.BACKUP_TIMEZONE }); } catch { errors.push('BACKUP_TIMEZONE must be a valid IANA time zone.'); }

const notificationBatchSize = Number(values.NOTIFICATION_BATCH_SIZE);
if (!Number.isInteger(notificationBatchSize) || notificationBatchSize < 1 || notificationBatchSize > 10_000) {
  errors.push('NOTIFICATION_BATCH_SIZE must be an integer between 1 and 10000.');
}

if (values.S3_ENDPOINT) {
  try { new URL(values.S3_ENDPOINT); } catch { errors.push('S3_ENDPOINT must be a valid absolute URL when provided.'); }
}
if (values.SMTP_HOST) {
  if (Boolean(values.SMTP_USER) !== Boolean(values.SMTP_PASS)) errors.push('SMTP_USER and SMTP_PASS must both be set or both be empty.');
  const smtpPort = Number(values.SMTP_PORT || 587);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) errors.push('SMTP_PORT must be between 1 and 65535.');
  if (placeholder(values.SMTP_FROM)) errors.push('SMTP_FROM must use a real sender address when SMTP is configured.');
  if (String(values.SMTP_SECURE).toLowerCase() !== 'true' && String(values.SMTP_REQUIRE_TLS).toLowerCase() !== 'true') errors.push('SMTP_REQUIRE_TLS must be true when SMTP_SECURE is false.');
}

if (/mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/[^?]+$/.test(values.MONGODB_URI || '')) {
  warnings.push('MongoDB URI has no credentials. This is acceptable only when MongoDB is bound to localhost and protected by the server firewall; database authentication is strongly recommended.');
}
if (!values.SMTP_HOST) warnings.push('SMTP is not configured; email delivery features will remain disabled.');
if (String(values.CLAMAV_ENABLED).toLowerCase() === 'true') warnings.push('CLAMAV_ENABLED is ignored because external malware scanning is disabled by application policy.');

if (warnings.length) {
  console.warn('Production environment warnings:\n');
  for (const warning of warnings) console.warn(`- ${warning}`);
  console.warn('');
}
if (errors.length) {
  console.error('Production environment validation failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Production environment validation passed.');
