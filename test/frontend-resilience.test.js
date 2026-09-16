import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const routes = fs.readFileSync(new URL('../src/app/routes.tsx', import.meta.url), 'utf8');
const lazyRetry = fs.readFileSync(new URL('../src/app/utils/lazyWithRetry.ts', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/app/services/api.ts', import.meta.url), 'utf8');
const authContext = fs.readFileSync(new URL('../src/app/context/AuthContext.tsx', import.meta.url), 'utf8');
const siteContext = fs.readFileSync(new URL('../src/app/context/SiteContext.tsx', import.meta.url), 'utf8');
const login = fs.readFileSync(new URL('../src/app/pages/LoginPage.tsx', import.meta.url), 'utf8');
const publicPages = fs.readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
const platformDefaults = fs.readFileSync(new URL('../server/src/services/platformDefaults.js', import.meta.url), 'utf8');
const platformConfiguration = fs.readFileSync(new URL('../server/src/services/platformConfiguration.js', import.meta.url), 'utf8');
const modulePage = fs.readFileSync(new URL('../src/app/pages/app/ModulePage.tsx', import.meta.url), 'utf8');
const appShell = fs.readFileSync(new URL('../src/app/components/layout/AppShell.tsx', import.meta.url), 'utf8');
const frontLayout = fs.readFileSync(new URL('../src/app/components/FrontLayout.tsx', import.meta.url), 'utf8');
const runtimeData = fs.readFileSync(new URL('../src/app/utils/runtimeData.ts', import.meta.url), 'utf8');
const routeError = fs.readFileSync(new URL('../src/app/components/shared/RouteErrorPage.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
const spaMiddleware = fs.readFileSync(new URL('../server/src/middleware/spa.js', import.meta.url), 'utf8');
const viteConfig = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const buildScript = fs.readFileSync(new URL('../scripts/build-production.js', import.meta.url), 'utf8');
const advancedRental = fs.readFileSync(new URL('../scripts/migrate-advanced-rental.js', import.meta.url), 'utf8');

test('all route-level imports use one-time chunk recovery and a user-facing error boundary', () => {
  assert.doesNotMatch(routes, /\blazy\(/);
  assert.match(routes, /lazyWithRetry/);
  assert.match(routes, /errorElement: <RouteErrorPage \/>/);
  assert.match(lazyRetry, /window\.location\.reload\(\)/);
  assert.match(lazyRetry, /sessionStorage/);
});

test('authentication and public entry actions cannot remain in an unbounded loading state', () => {
  assert.match(api, /function fetchWithTimeout/);
  assert.match(api, /SecureAssetTimeoutError/);
  assert.match(api, /AUTH_REQUEST_TIMEOUT_MS/);
  assert.match(api, /UPLOAD_REQUEST_TIMEOUT_MS/);
  assert.match(authContext, /refreshPromise/);
  assert.match(login, /if \(loading\) return;/);
  assert.match(login, /type="button" onClick=\{resendRegistration\}/);
  assert.match(login, /challenge\.developmentOtp/);
  assert.match(siteContext, /function mergeSiteData/);
  assert.match(publicPages, /login\?mode=register/);
  assert.match(platformDefaults, /primaryUrl: '\/login\?mode=register'/);
});

test('shared shells validate remote collections before rendering them', () => {
  assert.match(runtimeData, /export function safeRecordArray/);
  assert.match(siteContext, /CACHE_TTL_MS/);
  assert.match(siteContext, /inFlight/);
  assert.match(appShell, /safeRecordArray\(response\?\.data\?\.modules\)/);
  assert.match(modulePage, /safeRecordArray\(response\?\.data\?\.modules\)/);
  assert.match(frontLayout, /configuredNavigation = safeRecordArray/);
  assert.match(app, /window\.localStorage\.getItem/);
  assert.match(app, /preference storage is optional/);
});

test('file requests and route recovery have bounded, diagnosable failure paths', () => {
  assert.match(api, /async function fetchBinary/);
  assert.match(api, /The web server returned the application page instead of the requested file/);
  assert.match(api, /xhr\.timeout = UPLOAD_REQUEST_TIMEOUT_MS/);
  assert.match(routeError, /errorCode = chunkFailure \? 'asset-version'/);
  assert.match(routeError, /SecureAsset route error/);
  assert.match(routeError, /secureasset_chunk_reload_count/);
});

test('production HTML is never cached as a stale route shell', () => {
  assert.match(spaMiddleware, /X-SecureAsset-Frontend-Release/);
  assert.match(spaMiddleware, /Cache-Control.*no-store/);
  assert.doesNotMatch(spaMiddleware, /Cloudflare-CDN-Cache-Control/);
});

test('authenticated pages do not eagerly load the admin icon catalogue', () => {
  assert.match(appShell, /from ['"]\.\.\/\.\.\/iconResolver['"]/);
  assert.match(modulePage, /const SiteAdministrationPage = lazyWithRetry/);
  assert.doesNotMatch(viteConfig, /id\.includes\(['"]\/@mui\/icons-material\//);
});

test('legacy pages are removed from the active survey workflow and old links converge on canonical routes', () => {
  assert.match(routes, /LegacyPropertyActionRedirect/);
  assert.match(routes, /apply-property\/:propertyId', element/);
  assert.match(routes, /schedule-visit\/:propertyId', element/);
  assert.doesNotMatch(modulePage, /SurveyorSurveysPage|SurveyorFieldPage|SurveyorInvoicesPage/);
  assert.match(platformDefaults, /RETIRED_SURVEYOR_MODULE_KEYS/);
  assert.match(platformDefaults, /RBAC_PLATFORM_MODULES\.filter\(\(module\) => !RETIRED_SURVEYOR_MODULE_KEYS\.has\(module\.key\)\)/);
  assert.match(platformConfiguration, /RETIRED_SURVEYOR_MODULE_KEYS/);
  assert.match(platformConfiguration, /stale catalogs cannot expose duplicate pages/);
});

test('frontend build activates a verified release atomically', () => {
  assert.match(buildScript, /\.frontend-releases/);
  assert.match(buildScript, /verify-production-build\.js/);
  assert.match(buildScript, /symlinkSync/);
  assert.match(buildScript, /renameSync\(temporaryLink, distPath\)/);
});

test('advanced rental migration never seeds operational demo records by default', () => {
  assert.match(advancedRental, /demoRentalDataEnabled\(\)/);
  assert.match(advancedRental, /Operational demo records skipped/);
  assert.doesNotMatch(advancedRental, /vault-document-id/);
});
