import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Open Sans is self-hosted, preloaded, and enforced on every browser surface', () => {
  const fonts = read('src/styles/fonts.css');

  assert.match(fonts, /font-family: 'Open Sans';/);
  assert.match(fonts, /src: url\('\/fonts\/open-sans-latin-variable\.woff2'\) format\('woff2'\);/);
  assert.match(fonts, /src: url\('\/fonts\/open-sans-latin-variable-italic\.woff2'\) format\('woff2'\);/);
  assert.match(fonts, /body,\s*body \*,\s*body \*::before,\s*body \*::after\s*\{[\s\S]*font-family: var\(--sa-font-family\) !important;/);
  assert.doesNotMatch(fonts, /fonts\.googleapis\.com|fonts\.gstatic\.com|geist-latin/i);
  assert.match(read('index.html'), /rel="preload"[^>]+fonts\/open-sans-latin-variable\.woff2/);
  assert.ok(fs.statSync(path.join(root, 'public/fonts/open-sans-latin-variable.woff2')).size > 1000);
  assert.ok(fs.statSync(path.join(root, 'public/fonts/open-sans-latin-variable-italic.woff2')).size > 1000);
});

test('theme, design defaults, and configuration controls cannot select another font', () => {
  const app = read('src/app/App.tsx');
  const designSystem = read('src/app/designSystem.ts');
  const studio = read('src/app/pages/app/AdvancedDesignStudio.tsx');
  const administration = read('src/app/pages/app/SiteAdministrationPage.tsx');

  assert.match(app, /fontFamily: OPEN_SANS_FONT_FAMILY/);
  assert.match(app, /'body, body \*': \{ fontFamily: `\$\{OPEN_SANS_FONT_FAMILY\} !important` \}/);
  assert.match(designSystem, /export const OPEN_SANS_FONT_NAME = 'Open Sans';/);
  assert.match(designSystem, /fontFamily: OPEN_SANS_FONT_NAME/);
  assert.doesNotMatch(designSystem, /Plus Jakarta Sans|DM Sans|Geist/);
  assert.match(studio, /options=\{\[OPEN_SANS_FONT_NAME\]\}/);
  assert.match(studio, /Open Sans is enforced across the application\./);
  assert.match(administration, /Open Sans is enforced across all application surfaces\./);
});

test('server defaults, persisted settings, and report exports preserve the Open Sans policy', () => {
  const model = read('server/src/models/propertyManagement.js');
  const defaults = read('server/src/services/platformDefaults.js');
  const siteController = read('server/src/controllers/siteController.js');
  const resourceController = read('server/src/controllers/resourceController.js');
  const migration = read('scripts/migrate-open-sans-global.js');
  const automaticMigrations = read('scripts/run-automatic-migrations.js');
  const exports = read('server/src/controllers/surveyReportExportController.js');

  assert.match(model, /fontFamily: \{ type: String, default: 'Open Sans'/);
  assert.match(defaults, /typography: \{ fontFamily: 'Open Sans'/);
  assert.match(siteController, /fontFamily: OPEN_SANS_FONT_NAME/);
  assert.match(resourceController, /fontFamily: 'Open Sans'/);
  assert.match(migration, /export function applyOpenSansToSiteSetting/);
  assert.match(migration, /Open Sans is now enforced/);
  assert.match(automaticMigrations, /command: 'migrate:open-sans'/);
  assert.match(exports, /font-family:"Open Sans",Arial,sans-serif/);
  assert.match(exports, /font-family="Open Sans, Arial, sans-serif"/);
  assert.doesNotMatch(exports, /font-family:Arial|font-family="Arial"/);
});
