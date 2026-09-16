import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const logo = readFileSync(new URL('../src/app/components/premium/LogoMark.tsx', import.meta.url), 'utf8');
const frontLayout = readFileSync(new URL('../src/app/components/FrontLayout.tsx', import.meta.url), 'utf8');
const publicDrive = readFileSync(new URL('../src/app/pages/PublicDrivePage.tsx', import.meta.url), 'utf8');
const siteAdministration = readFileSync(new URL('../src/app/pages/app/SiteAdministrationPage.tsx', import.meta.url), 'utf8');
const resourceController = readFileSync(new URL('../server/src/controllers/resourceController.js', import.meta.url), 'utf8');

test('the administrator logo is one canonical asset across all visible shells', () => {
  assert.match(logo, /export function resolveSiteLogoUrl/);
  assert.match(logo, /settings\.logoUrl/);
  assert.match(logo, /settings\.design\?\.branding\?\.logoUrl/);
  assert.match(logo, /settings\.brand\?\.logoUrl/);
  assert.match(logo, /settings\.logoLightUrl/);
  assert.match(frontLayout, /resolveSiteLogoUrl\(settings\)/);
  assert.match(frontLayout, /logo: canonicalLogoUrl/);
  assert.match(publicDrive, /<LogoMark \/>/);
  assert.match(readFileSync(new URL('../src/app/components/layout/AppShell.tsx', import.meta.url), 'utf8'), /<LogoMark light \/>/);
});

test('both admin logo editors and direct site-settings API updates synchronize duplicate logo fields', () => {
  assert.match(siteAdministration, /synchroniseLogoSources/);
  assert.match(siteAdministration, /synchroniseLogoSources\(\{ \.\.\.settings \}, 'design'\)/);
  assert.match(siteAdministration, /synchroniseLogoSources\(\{\.\.\.settings\},'site'\)/);
  assert.match(resourceController, /function synchroniseSiteBrandAssets/);
  assert.match(resourceController, /req\.params\.resource === 'site-settings'/);
  assert.match(resourceController, /synchroniseSiteBrandAssets\(changes, previousValue\)/);
});
