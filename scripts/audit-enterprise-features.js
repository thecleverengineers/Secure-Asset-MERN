import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { DEFAULT_PLATFORM_MODULES } from '../server/src/services/platformDefaults.js';
import { resources } from '../server/src/services/resources.js';
import '../server/src/models/index.js';

const root = process.cwd();
const errors = [];
const warnings = [];
const checks = [];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const record = (name, passed, details = '') => {
  checks.push({ name, passed, details });
  if (!passed) errors.push(`${name}${details ? `: ${details}` : ''}`);
};

const packageJson = JSON.parse(read('package.json'));
record('Node engine locks the Node 24 release line', packageJson.engines?.node === '>=24.18.0 <25', packageJson.engines?.node || 'missing');
record('npm engine locks npm 11.16', packageJson.engines?.npm === '>=11.16.0 <12', packageJson.engines?.npm || 'missing');
record('Enterprise migration is part of deployment', read('scripts/deploy-production.sh').includes('npm run migrate:enterprise'));
record('Legacy uploads migrate into the encrypted Vault', read('scripts/deploy-production.sh').includes('npm run migrate:legacy-uploads') && read('server/src/controllers/uploadController.js').includes('DriveFileVersion.create'));
record('Production readiness check gates deployment', read('scripts/deploy-production.sh').includes('/api/health/ready'));
record('Production deploy executes full verification', read('scripts/deploy-production.sh').includes('npm run verify'));
record('Production verification builds frontend before browser-route tests', (() => {
  const verify = packageJson.scripts?.verify || '';
  return verify.indexOf('npm run build') !== -1 && verify.indexOf('npm run test') !== -1 && verify.indexOf('npm run build') < verify.indexOf('npm run test');
})(), packageJson.scripts?.verify || 'missing');
record('Offline verification builds frontend before browser-route tests', (() => {
  const verify = packageJson.scripts?.['verify:offline'] || '';
  return verify.indexOf('npm run build') !== -1 && verify.indexOf('npm run test') !== -1 && verify.indexOf('npm run build') < verify.indexOf('npm run test');
})(), packageJson.scripts?.['verify:offline'] || 'missing');
record('PM2 includes API process', read('ecosystem.config.cjs').includes("name: 'secureasset'"));
record('PM2 includes rental automation', read('ecosystem.config.cjs').includes("name: 'secureasset-rental-automation'"));
record('PM2 includes vault retention', read('ecosystem.config.cjs').includes("name: 'secureasset-vault-retention'"));
record('PM2 includes notification delivery', read('ecosystem.config.cjs').includes("name: 'secureasset-notification-delivery'"));
record('PM2 includes daily encrypted backup automation', read('ecosystem.config.cjs').includes("name: 'secureasset-backup-automation'") && read('ecosystem.config.cjs').includes('BACKUP_CRON'));
record('Encrypted backup recovery service is packaged', read('server/src/services/backupRecovery.js').includes('aes-256-gcm') && read('server/src/models/backupRecovery.js').includes('SystemBackupSchema'));
record('Offline-safe laptop backup tooling is packaged', read('scripts/laptop-backup-pull.sh').includes('StrictHostKeyChecking=yes') && read('scripts/setup-laptop-backup-pull.sh').includes('ForceCommand internal-sftp'));

const moduleIds = new Set();
for (const module of DEFAULT_PLATFORM_MODULES) {
  const id = `${module.scope}:${module.key}`;
  if (moduleIds.has(id)) errors.push(`Duplicate platform module ${id}`);
  moduleIds.add(id);
  if (module.scope === 'app' && !Array.isArray(module.accessRules)) errors.push(`${id} has no accessRules`);
}
record('Platform module keys are unique', !errors.some((value) => value.startsWith('Duplicate platform module')), `${moduleIds.size} module records`);

const modulePage = read('src/app/pages/app/ModulePage.tsx');
const resourcePage = read('src/app/pages/app/ResourcePage.tsx');
const resourceBlock = resourcePage.split('const configs:')[1]?.split('function getValue')[0] || '';
const uiResources = new Set([...resourceBlock.matchAll(/^ {2}['"]?([a-z0-9-]+)['"]?: \{/gm)].map((match) => match[1]));
const specialized = new Set([...modulePage.matchAll(/module === '([^']+)'/g)].map((match) => match[1]));
for (const key of ['dashboard', 'profile', 'reports', 'my-property']) specialized.add(key);
const external = new Set(DEFAULT_PLATFORM_MODULES.filter((module) => module.kind === 'external').map((module) => module.key));
function appRouteTarget(module = {}) {
  const modulePath = String(module.path || `/app/${module.key}`).split('?')[0].split('#')[0];
  const match = modulePath.match(/^\/app\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : module.key;
}
const enabledAppModules = [...new Map(DEFAULT_PLATFORM_MODULES
  .filter((module) => module.scope === 'app' && module.enabled)
  .map((module) => [`${module.key}:${module.path || ''}`, module]))
  .values()];
const unresolvedModules = enabledAppModules
  .filter((module) => {
    const target = appRouteTarget(module);
    return !uiResources.has(target) && !specialized.has(target) && !external.has(module.key) && !external.has(target);
  })
  .map((module) => module.key);
record('Every enabled application module resolves to a functional screen', unresolvedModules.length === 0, unresolvedModules.join(', '));

const knownResourceBackends = new Set(Object.keys(resources));
const missingBackends = [...uiResources].filter((key) => !knownResourceBackends.has(key));
record('Every generic resource screen has a MongoDB resource contract', missingBackends.length === 0, missingBackends.join(', '));

for (const [name, Model] of Object.entries(mongoose.models)) {
  const textIndexes = Model.schema.indexes().filter(([keys]) => Object.values(keys).includes('text'));
  if (textIndexes.length > 1) errors.push(`${name} declares multiple text indexes`);
}
record('Every MongoDB collection declares at most one text index', !errors.some((value) => value.includes('multiple text indexes')), `${Object.keys(mongoose.models).length} models`);

function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'dist', '.git'].includes(entry.name) ? [] : walk(relative);
    return /\.(js|ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}
const sourceFiles = [...walk('src'), ...walk('server'), ...walk('scripts')].filter((file) => file !== 'scripts/audit-enterprise-features.js');
const forbiddenPatterns = [
  { label: 'native browser alert/prompt/confirm', pattern: /(^|[^A-Za-z])(window\.)?(alert|prompt|confirm)\s*\(/m },
  { label: 'browser-persisted access token', pattern: /localStorage\.(getItem|setItem)\(['"]sa_(token|user)['"]/ },
  { label: 'legacy mock database import', pattern: /mockDb/ },
  { label: 'dummy placeholder page', pattern: /DummyPages/ },
];
for (const rule of forbiddenPatterns) {
  const matches = sourceFiles.filter((file) => rule.pattern.test(read(file)));
  record(`No ${rule.label}`, matches.length === 0, matches.join(', '));
}

const placeholderMatches = [];
for (const file of sourceFiles) {
  const source = read(file);
  if (/\b(TODO|FIXME|NOT IMPLEMENTED|COMING SOON)\b/i.test(source)) placeholderMatches.push(file);
}
record('No unfinished feature markers in production source', placeholderMatches.length === 0, placeholderMatches.join(', '));
record('Legacy upload endpoint does not persist public upload URLs', !read('server/src/controllers/uploadController.js').includes('`/uploads/${'));

const app = read('server/src/app.js');
record('Readiness and liveness endpoints are implemented', app.includes('/api/health/live') && app.includes('/api/health/ready'));
record('Request context and unsafe-key protection are enabled', app.includes('requestContext'));
record('Realtime messaging route is mounted', app.includes('messagingRoutes'));
record('Notification route is mounted', app.includes('notificationRoutes'));
record('Admin backup recovery route is mounted', app.includes("'/api/v1/backup-recovery'"));
record('Dynamic public-site configuration route is mounted', app.includes('siteRoutes'));
record('Production SPA route fallback is mounted', app.includes('mountProductionSpa'));
record('Nginx SPA fallback template is included', read('deploy/nginx/secureasset-static.conf.template').includes('try_files $uri $uri/ /index.html'));
record('Deployment verifies browser-route reloads', read('scripts/deploy-production.sh').includes('Checking browser-route reload fallback'));
record('Client/server API route contract validation is enabled', packageJson.scripts?.verify?.includes('route:check'));

const api = read('src/app/services/api.ts');
const clientRoutes = read('src/app/routes.tsx');
record('Client uses refresh-cookie session restoration', api.includes('/auth/refresh'));
record('Client implements two-factor challenge completion', api.includes('/auth/two-factor/challenge'));
record(
  'Password reset has a dedicated route',
  /path:\s*['"]\/?reset-password['"]\s*,\s*Component:\s*ResetPasswordPage/.test(clientRoutes),
  'Expected the public router to mount ResetPasswordPage at reset-password',
);
record('Authentication presentation is database-driven', read('src/app/pages/LoginPage.tsx').includes('settings.authentication'));
record('Security and session management screen is implemented', read('src/app/pages/app/ModulePage.tsx').includes('SecurityPage'));
record('Client exposes realtime messaging APIs', api.includes('getConversations') && api.includes('sendConversationMessage'));
record('Client exposes Document Vault APIs', api.includes('getDriveBootstrap') && api.includes('uploadDriveFile'));
record('Client exposes database-driven site configuration', api.includes('getSiteConfig') && api.includes('getAppConfiguration'));

if (warnings.length) {
  console.warn('Enterprise audit warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}
if (errors.length) {
  console.error('Enterprise feature audit failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Enterprise audit passed: ${checks.length} contracts, ${DEFAULT_PLATFORM_MODULES.length} module records, ${Object.keys(resources).length} resources, ${Object.keys(mongoose.models).length} models.`);
