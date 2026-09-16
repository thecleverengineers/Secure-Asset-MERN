import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const designSystem = read('src/app/designSystem.ts');
const model = read('server/src/models/propertyManagement.js');
const defaults = read('server/src/services/platformDefaults.js');
const configuration = read('server/src/services/platformConfiguration.js');
const controller = read('server/src/controllers/siteController.js');
const studio = read('src/app/pages/app/AdvancedDesignStudio.tsx');
const vault = read('src/app/pages/app/DocumentVaultPage.tsx');
const frontLayout = read('src/app/components/FrontLayout.tsx');
const appShell = read('src/app/components/layout/AppShell.tsx');

test('v197 persists safe administrator-controlled icon assets through site settings', () => {
  for (const source of [designSystem, model, defaults, configuration, controller]) assert.match(source, /iconAssets/);
  assert.match(model, /IconAssetsSchema/);
  assert.match(model, /Icon assets must be HTTPS or local asset paths/);
  assert.match(designSystem, /normaliseAssetMap/);
  assert.match(controller, /quickAccess: \{ \...DEFAULT_DESIGN_SYSTEM\.iconAssets\.quickAccess/);
});

test('v197 gives administrators image uploads for the bottom bar, global sharing and Quick Access cards', () => {
  for (const label of ['Bottom app bar icons', 'Global share icon', 'Quick Access category icons', 'Upload']) assert.match(studio, new RegExp(label));
  for (const key of ['iconAssets.bottomAppBar', 'iconAssets.globalShare', 'iconAssets.quickAccess']) assert.match(studio, new RegExp(key.replaceAll('.', '\\.')));
  assert.match(studio, /uploadSiteAsset/);
});

test('v197 renders configured icons in both bottom navigation shells and the vault', () => {
  assert.match(frontLayout, /configuredBottomIcon/);
  assert.match(appShell, /configuredBottomIcon/);
  assert.match(vault, /VaultConfiguredIcon/);
  assert.match(vault, /design\.iconAssets\.quickAccess\[item\.key\]/);
  assert.match(vault, /design\.iconAssets\.globalShare/);
});

test('v197 direct Share is file-only, confirmation-free and updates rename/delete locally', () => {
  const shareBody = vault.slice(vault.indexOf('async function instantShare'), vault.indexOf('async function createLink'));
  assert.doesNotMatch(shareBody, /askConfirmation/);
  assert.match(vault, />Share<\/Button>/);
  assert.match(vault, /patchVisibleDriveItem/);
  assert.match(vault, /removeVisibleDriveItem/);
  assert.match(vault, /toast\.success\('Renamed successfully'\); return/);
  assert.match(vault, /toast\.success\('Moved to Trash'\); return/);
  assert.match(vault, /toast\.success\('Deleted permanently'\); return/);
});
