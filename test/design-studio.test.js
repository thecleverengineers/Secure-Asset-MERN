import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const model = readFileSync(new URL('../server/src/models/propertyManagement.js', import.meta.url), 'utf8');
const defaults = readFileSync(new URL('../server/src/services/platformDefaults.js', import.meta.url), 'utf8');
const configuration = readFileSync(new URL('../server/src/services/platformConfiguration.js', import.meta.url), 'utf8');
const siteController = readFileSync(new URL('../server/src/controllers/siteController.js', import.meta.url), 'utf8');
const resources = readFileSync(new URL('../server/src/services/resources.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/app/components/layout/AppShell.tsx', import.meta.url), 'utf8');
const studio = readFileSync(new URL('../src/app/pages/app/SiteAdministrationPage.tsx', import.meta.url), 'utf8');
const liveStudio = readFileSync(new URL('../src/app/pages/app/AdvancedDesignStudio.tsx', import.meta.url), 'utf8');
const studioRoute = readFileSync(new URL('../src/app/pages/app/DesignStudioPage.tsx', import.meta.url), 'utf8');
const modulePage = readFileSync(new URL('../src/app/pages/app/ModulePage.tsx', import.meta.url), 'utf8');
const designSystem = readFileSync(new URL('../src/app/designSystem.ts', import.meta.url), 'utf8');

test('application design system persists safe, bounded tokens in MongoDB', () => {
  assert.match(model, /const DesignSystemSchema = new Schema/);
  assert.match(model, /design: \{ type: DesignSystemSchema/);
  assert.match(model, /HEX_COLOUR/);
  assert.match(model, /appBarHeight: boundedNumber\(76, 56, 96\)/);
  assert.match(model, /modalRadius: boundedNumber\(0, 0, 32\)/);
  assert.match(resources, /'design'/);
});

test('legacy site settings receive design defaults and public configuration exposes them', () => {
  assert.match(defaults, /export const DEFAULT_DESIGN_SYSTEM/);
  assert.match(configuration, /design: \{ \$exists: false \}/);
  assert.match(configuration, /design: DEFAULT_DESIGN_SYSTEM/);
  assert.match(siteController, /withDesignDefaults/);
  assert.match(siteController, /design: withDesignDefaults\(setting\.design\)/);
});

test('the published visual system reaches global MUI components and the workspace frame', () => {
  for (const token of ['MuiCard', 'MuiDialog', 'MuiMenu', 'MuiButton', 'MuiOutlinedInput', 'MuiSvgIcon']) assert.match(app, new RegExp(token));
  assert.match(app, /normaliseDesignSystem/);
  assert.match(shell, /design\.layout\.sidebarWidth/);
  assert.match(shell, /design\.layout\.appBarHeight/);
  assert.match(shell, /design\.borders\.navigationRadius/);
});

test('administrators receive presets, granular component controls, preview and publish flow', () => {
  for (const label of ['Design presets', 'Brand colours', 'Typography & density', 'Layout & resize', 'Borders, radii & component shape', 'Depth, icons & motion', 'Staged design preview']) assert.match(studio, new RegExp(label));
  assert.match(studio, /Publish application design/);
  assert.match(studio, /Restore SecureAsset default/);
  assert.match(studio, /DESIGN_PRESETS/);
});

test('Design Studio is an independent admin sidebar route with live bounded layer controls', () => {
  assert.match(shell, /'design-studio': \{ key: 'design-studio', label: 'Design Studio'/);
  assert.match(modulePage, /module === 'design-studio'.*DesignStudioPage/s);
  assert.match(studioRoute, /StandaloneDesignStudio/);
  for (const control of ['Background image / asset URL', 'Erase image', 'Resize layer', 'Border px', 'Radius', 'Box shadow', 'Padding', 'Margin', 'Z-index', 'Font family', 'Font size', 'Position', 'Width sizing', 'Height sizing', 'Image crop & object positioning', 'Live page', 'Redesign']) assert.match(liveStudio, new RegExp(control));
  assert.match(liveStudio, /pageKey === pageKey/);
  assert.match(liveStudio, /materialiseLayers/);
  assert.match(liveStudio, /applicationPages/);
  assert.match(liveStudio, /All application pages/);
  assert.match(liveStudio, /content-page/);
  assert.match(designSystem, /export function matchesDesignPath/);
  assert.match(designSystem, /slice\(0, 400\)/);
  assert.match(model, /pageDesigns cannot contain more than 400 pages/);
  assert.match(model, /canvas cannot contain more than 1600 layers/);
});
