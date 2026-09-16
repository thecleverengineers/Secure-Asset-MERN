import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const appDir = path.resolve(process.env.APP_DIR || process.cwd());
const envPath = path.join(appDir, '.env');
const templateCandidates = [
  path.join(appDir, '.env.oneclick.example'),
  path.join(appDir, '.env.production.example'),
  path.join(appDir, '.env.example'),
  // Some release systems copy only non-hidden files. Keep a visible template
  // location in the search path for those deployments.
  path.join(appDir, 'scripts', 'templates', 'production.env.example'),
  path.join(appDir, 'scripts', '.env.production.example'),
];

const DEFAULT_PUBLIC_URL = 'https://secureasset.in';
const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017/secureasset';

// The deploy script must remain recoverable when a hosting panel or an
// archive extractor drops dot-files. This is deliberately a minimal,
// production-safe template: secrets are generated below, local storage is
// encrypted, demo data is disabled, and MongoDB is restricted to localhost.
// A real MONGODB_URI/APP_URL supplied by the operator always wins.
function builtInEnvironmentTemplate() {
  const publicUrl = process.env.PUBLIC_APP_URL
    || process.env.APP_URL
    || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : DEFAULT_PUBLIC_URL);
  const mongoUri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
  return [
    'NODE_ENV=production',
    `PORT=${process.env.PORT || '5000'}`,
    `MONGODB_URI=${mongoUri}`,
    `CLIENT_URL=${process.env.CLIENT_URL || publicUrl}`,
    `PUBLIC_APP_URL=${publicUrl}`,
    'JWT_ACCESS_SECRET=GENERATE_ON_DEPLOY',
    'JWT_REFRESH_SECRET=GENERATE_ON_DEPLOY',
    'ACCESS_TOKEN_TTL=15m',
    'REFRESH_TOKEN_TTL_DAYS=30',
    'SESSION_ROLLING_TTL_DAYS=30',
    'SESSION_ABSOLUTE_TTL_DAYS=90',
    'SESSION_RENEWAL_WINDOW_HOURS=24',
    'SESSION_ROTATION_GRACE_SECONDS=60',
    'JWT_ISSUER=secureasset-api',
    'JWT_AUDIENCE=secureasset-web',
    'ENCRYPTION_MASTER_KEY_BASE64=GENERATE_ON_DEPLOY',
    'LEGACY_PUBLIC_UPLOADS=false',
    'PAYMENT_AUTO_APPROVE=false',
    'STORAGE_DRIVER=local',
    'VAULT_STORAGE_DIR=/var/lib/secureasset/vault',
    'VAULT_ENCRYPTION_KEY=GENERATE_ON_DEPLOY',
    'VAULT_TEMP_DIR=/var/lib/secureasset/tmp',
    'VAULT_MAX_FILE_MB=250',
    'VAULT_CHUNK_MB=12',
    'TRASH_RETENTION_DAYS=60',
    'VAULT_PURGE_CRON=17 2 * * *',
    'BACKUP_STORAGE_DIR=/var/lib/secureasset/backup-pull/archives',
    'BACKUP_TEMP_DIR=/var/lib/secureasset/backup-tmp',
    'BACKUP_ENCRYPTION_KEY_BASE64=GENERATE_ON_DEPLOY',
    'BACKUP_RETENTION_DAYS=90',
    'BACKUP_CRON=0 17 * * *',
    'BACKUP_TIMEZONE=Asia/Kolkata',
    'BACKUP_RESTORE_TOKEN_TTL_MINUTES=15',
    'CLAMAV_ENABLED=false',
    'CLAMAV_COMMAND=clamdscan',
    'VITE_API_URL=/api/v1',
    'CMS_ASSET_DIR=/var/lib/secureasset/site-assets',
    'SMTP_SECURE=false',
    'SMTP_REQUIRE_TLS=true',
    'SMTP_TLS_REJECT_UNAUTHORIZED=true',
    'RENT_AUTOMATION_CRON=* * * * *',
    'NOTIFICATION_DELIVERY_CRON=* * * * *',
    'NOTIFICATION_BATCH_SIZE=200',
    'PM2_MAX_MEMORY=1G',
    'AUTO_DB_MIGRATIONS=true',
    'AUTO_DB_MIGRATION_LOCK_TTL_MS=1200000',
    'AUTO_DB_MIGRATION_WAIT_MS=1800000',
    'AUTO_DB_MIGRATION_POLL_MS=3000',
    'SEED_DEMO_RENTAL_DATA=false',
    '',
  ].join('\n');
}

function parseEnv(text) {
  const entries = new Map();
  const order = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!entries.has(key)) order.push(key);
    entries.set(key, value);
  }
  return { entries, order };
}

function serialise({ entries, order }) {
  const seen = new Set();
  const lines = [];
  for (const key of order) {
    if (!entries.has(key) || seen.has(key)) continue;
    seen.add(key);
    lines.push(`${key}=${entries.get(key)}`);
  }
  for (const [key, value] of entries) {
    if (seen.has(key)) continue;
    lines.push(`${key}=${value}`);
  }
  return `${lines.join('\n')}\n`;
}

function randomSecret(bytes = 48) {
  return crypto.randomBytes(bytes).toString('hex');
}

function isPlaceholder(value = '') {
  return !value || /GENERATE_|CHANGE_THIS|USER:PASSWORD|CLUSTER|example\.com|change-this/i.test(value);
}

let source = '';
let sourceDescription = '';
if (fs.existsSync(envPath)) {
  source = fs.readFileSync(envPath, 'utf8');
  sourceDescription = envPath;
} else {
  const template = templateCandidates.find((candidate) => fs.existsSync(candidate));
  if (template) {
    source = fs.readFileSync(template, 'utf8');
    sourceDescription = template;
  } else {
    source = builtInEnvironmentTemplate();
    sourceDescription = 'built-in safe defaults';
    console.warn('WARNING: No environment template was found; using built-in safe defaults.');
    console.warn('Set APP_URL/PUBLIC_APP_URL and MONGODB_URI for the target installation before exposing it publicly.');
  }
}

const config = parseEnv(source);
const legacyEdgeKeyPattern = /^CLOUDFLARE_/;
const removedLegacyEdgeKeys = [...config.entries.keys()].filter((key) => legacyEdgeKeyPattern.test(key));
for (const key of removedLegacyEdgeKeys) config.entries.delete(key);
config.order = config.order.filter((key) => !legacyEdgeKeyPattern.test(key));
const set = (key, value, force = false) => {
  if (value === undefined || value === null || value === '') return;
  const current = config.entries.get(key);
  if (force || !current || isPlaceholder(current)) {
    if (!config.entries.has(key)) config.order.push(key);
    config.entries.set(key, String(value));
  }
};

set('NODE_ENV', 'production', true);
set('PORT', process.env.PORT || config.entries.get('PORT') || '5000', true);

// Resolve URLs from explicit deploy variables first, then preserve an
// existing configured value, and finally use the branded production default.
// This also repairs partially copied .env files instead of producing a later,
// opaque validation error.
const explicitAppUrl = process.env.PUBLIC_APP_URL
  || process.env.APP_URL
  || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : '');
const appUrl = explicitAppUrl
  || config.entries.get('CLIENT_URL')
  || config.entries.get('PUBLIC_APP_URL')
  || DEFAULT_PUBLIC_URL;
const currentClientUrl = config.entries.get('CLIENT_URL');
const currentPublicUrl = config.entries.get('PUBLIC_APP_URL');
set('CLIENT_URL', process.env.CLIENT_URL || currentClientUrl || appUrl,
  Boolean(process.env.CLIENT_URL || explicitAppUrl) || !currentClientUrl || isPlaceholder(currentClientUrl));
set('PUBLIC_APP_URL', process.env.PUBLIC_APP_URL || currentPublicUrl || appUrl,
  Boolean(explicitAppUrl) || !currentPublicUrl || isPlaceholder(currentPublicUrl));

const currentMongoUri = config.entries.get('MONGODB_URI');
set('MONGODB_URI', process.env.MONGODB_URI || currentMongoUri || DEFAULT_MONGODB_URI,
  Boolean(process.env.MONGODB_URI) || !currentMongoUri || isPlaceholder(currentMongoUri));

// The browser and API are deployed on the same public origin. Always repair
// legacy localhost values unless an explicit external API URL is provided to
// this deployment command. A localhost API base works only on the server and
// causes every real visitor's login/registration request to fail.
set('VITE_API_URL', process.env.VITE_API_URL || '/api/v1', true);

// Materialise the persistent-session policy on upgrades too. Existing
// installations may have a v97 .env without these keys; adding defaults here
// lets the new BFF session store deploy without requiring a manual logout or
// hand-edit on every server.
set('SESSION_ROLLING_TTL_DAYS', process.env.SESSION_ROLLING_TTL_DAYS || config.entries.get('SESSION_ROLLING_TTL_DAYS') || '30', !config.entries.has('SESSION_ROLLING_TTL_DAYS'));
set('SESSION_ABSOLUTE_TTL_DAYS', process.env.SESSION_ABSOLUTE_TTL_DAYS || config.entries.get('SESSION_ABSOLUTE_TTL_DAYS') || '90', !config.entries.has('SESSION_ABSOLUTE_TTL_DAYS'));
set('SESSION_RENEWAL_WINDOW_HOURS', process.env.SESSION_RENEWAL_WINDOW_HOURS || config.entries.get('SESSION_RENEWAL_WINDOW_HOURS') || '24', !config.entries.has('SESSION_RENEWAL_WINDOW_HOURS'));
set('SESSION_ROTATION_GRACE_SECONDS', process.env.SESSION_ROTATION_GRACE_SECONDS || config.entries.get('SESSION_ROTATION_GRACE_SECONDS') || '60', !config.entries.has('SESSION_ROTATION_GRACE_SECONDS'));

if (isPlaceholder(config.entries.get('JWT_ACCESS_SECRET'))) set('JWT_ACCESS_SECRET', randomSecret(), true);
if (isPlaceholder(config.entries.get('JWT_REFRESH_SECRET'))) set('JWT_REFRESH_SECRET', randomSecret(), true);
if (isPlaceholder(config.entries.get('VAULT_ENCRYPTION_KEY'))) set('VAULT_ENCRYPTION_KEY', randomSecret(), true);
if (isPlaceholder(config.entries.get('ENCRYPTION_MASTER_KEY_BASE64'))) {
  set('ENCRYPTION_MASTER_KEY_BASE64', crypto.randomBytes(32).toString('base64'), true);
}
if (isPlaceholder(config.entries.get('BACKUP_ENCRYPTION_KEY_BASE64'))) {
  set('BACKUP_ENCRYPTION_KEY_BASE64', crypto.randomBytes(32).toString('base64'), true);
}

const explicitStorageDriver = process.env.STORAGE_DRIVER;
const existingStorageDriver = config.entries.get('STORAGE_DRIVER');
const storageDriver = explicitStorageDriver || (['local', 's3'].includes(existingStorageDriver) ? existingStorageDriver : 'local');
set('STORAGE_DRIVER', storageDriver, true);

set('VAULT_STORAGE_DIR', process.env.VAULT_STORAGE_DIR || '/var/lib/secureasset/vault', true);
set('VAULT_TEMP_DIR', process.env.VAULT_TEMP_DIR || '/var/lib/secureasset/tmp', true);
set('CMS_ASSET_DIR', process.env.CMS_ASSET_DIR || '/var/lib/secureasset/site-assets', true);
set('BACKUP_STORAGE_DIR', process.env.BACKUP_STORAGE_DIR || config.entries.get('BACKUP_STORAGE_DIR') || '/var/lib/secureasset/backup-pull/archives', true);
set('BACKUP_TEMP_DIR', process.env.BACKUP_TEMP_DIR || config.entries.get('BACKUP_TEMP_DIR') || '/var/lib/secureasset/backup-tmp', true);
set('LEGACY_PUBLIC_UPLOADS', 'false', true);

for (const key of [
  'S3_REGION', 'S3_BUCKET', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_SESSION_TOKEN', 'S3_FORCE_PATH_STYLE', 'S3_SSE', 'S3_KMS_KEY_ID',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_REQUIRE_TLS', 'SMTP_TLS_REJECT_UNAUTHORIZED', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
  'PM2_INSTANCES', 'PM2_MAX_MEMORY', 'RENT_AUTOMATION_CRON', 'VAULT_PURGE_CRON', 'NOTIFICATION_DELIVERY_CRON', 'NOTIFICATION_BATCH_SIZE',
  'BACKUP_RETENTION_DAYS', 'BACKUP_CRON', 'BACKUP_TIMEZONE', 'BACKUP_RESTORE_TOKEN_TTL_MINUTES',
  'SMS_WEBHOOK_URL', 'SMS_WEBHOOK_TOKEN', 'WHATSAPP_WEBHOOK_URL', 'WHATSAPP_WEBHOOK_TOKEN', 'PUSH_WEBHOOK_URL', 'PUSH_WEBHOOK_TOKEN',
  'AUTO_DB_MIGRATIONS', 'AUTO_DB_MIGRATION_LOCK_TTL_MS', 'AUTO_DB_MIGRATION_WAIT_MS', 'AUTO_DB_MIGRATION_POLL_MS', 'SEED_DEMO_RENTAL_DATA',
]) {
  set(key, process.env[key], Boolean(process.env[key]));
}

set('AUTO_DB_MIGRATIONS', config.entries.get('AUTO_DB_MIGRATIONS') || 'true', !config.entries.has('AUTO_DB_MIGRATIONS'));
set('SEED_DEMO_RENTAL_DATA', config.entries.get('SEED_DEMO_RENTAL_DATA') || 'false', !config.entries.has('SEED_DEMO_RENTAL_DATA'));
set('AUTO_DB_MIGRATION_LOCK_TTL_MS', config.entries.get('AUTO_DB_MIGRATION_LOCK_TTL_MS') || '1200000', !config.entries.has('AUTO_DB_MIGRATION_LOCK_TTL_MS'));
set('AUTO_DB_MIGRATION_WAIT_MS', config.entries.get('AUTO_DB_MIGRATION_WAIT_MS') || '1800000', !config.entries.has('AUTO_DB_MIGRATION_WAIT_MS'));
set('AUTO_DB_MIGRATION_POLL_MS', config.entries.get('AUTO_DB_MIGRATION_POLL_MS') || '3000', !config.entries.has('AUTO_DB_MIGRATION_POLL_MS'));

// Older one-click environments did not include every worker schedule. Always
// materialise safe production defaults so upgrades do not fail validation or
// leave PM2 workers with an implicit, undocumented schedule.
set('VAULT_PURGE_CRON', config.entries.get('VAULT_PURGE_CRON') || '17 2 * * *', !config.entries.get('VAULT_PURGE_CRON'));
// Upgrade the legacy once-daily SecureAsset default to minute-level billing;
// preserve any intentionally customised cron expression.
const currentRentalAutomationCron = config.entries.get('RENT_AUTOMATION_CRON');
const useMinuteRentalAutomation = !currentRentalAutomationCron || currentRentalAutomationCron === '7 1 * * *';
set('RENT_AUTOMATION_CRON', useMinuteRentalAutomation ? '* * * * *' : currentRentalAutomationCron, useMinuteRentalAutomation);
set('NOTIFICATION_DELIVERY_CRON', config.entries.get('NOTIFICATION_DELIVERY_CRON') || '* * * * *', !config.entries.get('NOTIFICATION_DELIVERY_CRON'));
set('NOTIFICATION_BATCH_SIZE', config.entries.get('NOTIFICATION_BATCH_SIZE') || '200', !config.entries.get('NOTIFICATION_BATCH_SIZE'));
set('BACKUP_RETENTION_DAYS', config.entries.get('BACKUP_RETENTION_DAYS') || '90', !config.entries.get('BACKUP_RETENTION_DAYS'));
set('BACKUP_CRON', config.entries.get('BACKUP_CRON') || '0 17 * * *', !config.entries.get('BACKUP_CRON'));
set('BACKUP_TIMEZONE', config.entries.get('BACKUP_TIMEZONE') || 'Asia/Kolkata', !config.entries.get('BACKUP_TIMEZONE'));
set('BACKUP_RESTORE_TOKEN_TTL_MINUTES', config.entries.get('BACKUP_RESTORE_TOKEN_TTL_MINUTES') || '15', !config.entries.get('BACKUP_RESTORE_TOKEN_TTL_MINUTES'));
set('PM2_MAX_MEMORY', config.entries.get('PM2_MAX_MEMORY') || '1G', !config.entries.get('PM2_MAX_MEMORY'));
set('SMTP_SECURE', config.entries.get('SMTP_SECURE') || 'false', !config.entries.has('SMTP_SECURE'));
set('SMTP_REQUIRE_TLS', config.entries.get('SMTP_REQUIRE_TLS') || 'true', !config.entries.has('SMTP_REQUIRE_TLS'));
set('SMTP_TLS_REJECT_UNAUTHORIZED', config.entries.get('SMTP_TLS_REJECT_UNAUTHORIZED') || 'true', !config.entries.has('SMTP_TLS_REJECT_UNAUTHORIZED'));
if (process.env.CLAMAV_ENABLED !== undefined) set('CLAMAV_ENABLED', process.env.CLAMAV_ENABLED, true);
else if (!config.entries.has('CLAMAV_ENABLED') || isPlaceholder(config.entries.get('CLAMAV_ENABLED'))) set('CLAMAV_ENABLED', 'false', true);

fs.writeFileSync(envPath, serialise(config), { mode: 0o600 });
fs.chmodSync(envPath, 0o600);
console.log(`Production environment prepared: ${envPath}`);
console.log(`Environment source: ${sourceDescription}`);
console.log(`Storage driver: ${config.entries.get('STORAGE_DRIVER')}`);
console.log(`Public URL: ${config.entries.get('PUBLIC_APP_URL') || '(missing)'}`);
console.log(`MongoDB: ${isPlaceholder(config.entries.get('MONGODB_URI')) ? '(missing)' : '(configured)'}`);
if (removedLegacyEdgeKeys.length) console.log(`Removed legacy external-edge settings: ${removedLegacyEdgeKeys.length}`);
