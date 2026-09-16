import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const defaults = readFileSync(new URL('../server/src/services/platformDefaults.js', import.meta.url), 'utf8');
const siteController = readFileSync(new URL('../server/src/controllers/siteController.js', import.meta.url), 'utf8');
const models = readFileSync(new URL('../server/src/models/propertyManagement.js', import.meta.url), 'utf8');
const resources = readFileSync(new URL('../server/src/services/resources.js', import.meta.url), 'utf8');
const frontLayout = readFileSync(new URL('../src/app/components/FrontLayout.tsx', import.meta.url), 'utf8');
const publicPages = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
const siteAdministration = readFileSync(new URL('../src/app/pages/app/SiteAdministrationPage.tsx', import.meta.url), 'utf8');
const resourcePage = readFileSync(new URL('../src/app/pages/app/ResourcePage.tsx', import.meta.url), 'utf8');

test('privacy, terms and callback pages are seeded as public MongoDB-backed content pages', () => {
  assert.match(defaults, /path: '\/privacy-policy', slug: 'privacy-policy'/);
  assert.match(defaults, /path: '\/terms-of-service', slug: 'terms-of-service'/);
  assert.match(defaults, /path: '\/callback', slug: 'callback'/);
  assert.match(defaults, /type: 'callback_form'/);
  assert.match(defaults, /export const DEFAULT_SITE_FOOTER/);
  assert.match(defaults, /label: 'Privacy Policy', path: '\/privacy-policy'/);
  assert.match(defaults, /label: 'Terms of Service', path: '\/terms-of-service'/);
});

test('footer configuration is exposed safely through the site settings resource and public configuration', () => {
  assert.match(models, /footer: \{[\s\S]*navigation: \[\{ heading: String/);
  assert.match(resources, /'maintenance', 'legal', 'footer'/);
  assert.match(siteController, /withFooterDefaults/);
  assert.match(siteController, /footer: withFooterDefaults\(setting\.footer\)/);
  assert.match(siteController, /DEFAULT_SITE_FOOTER/);
  assert.match(frontLayout, /settings\.footer\?\.navigation/);
  assert.match(frontLayout, /configuredLegalLinks/);
  assert.match(frontLayout, /settings\.footer\?\.description/);
  assert.match(frontLayout, /Request a callback/);
});

test('callback requests save a preferred time and appear in the admin enquiry workspace', () => {
  assert.match(models, /enum: \['contact', 'property', 'support', 'callback'\]/);
  assert.match(models, /preferredCallbackAt: Date, callbackWindow: String/);
  assert.match(siteController, /preferredCallbackAt/);
  assert.match(siteController, /A phone number is required for a callback request/);
  assert.match(resources, /'preferredCallbackAt', 'callbackWindow'/);
  assert.match(publicPages, /function PublicEnquiryForm/);
  assert.match(publicPages, /type: callback \? 'callback'/);
  assert.match(publicPages, /section\.type === 'callback_form'/);
  assert.match(resourcePage, /path:'preferredCallbackAt',label:'Callback time'/);
});

test('administrators can manage footer navigation, legal links and callback destination without code changes', () => {
  assert.match(siteAdministration, /'Footer & Legal Pages'/);
  assert.match(siteAdministration, /function FooterAdministration/);
  assert.match(siteAdministration, /Footer navigation groups/);
  assert.match(siteAdministration, /Footer legal & service links/);
  assert.match(siteAdministration, /Callback call-to-action/);
  assert.match(siteAdministration, /<FooterAdministration settings=\{settings\} setSettings=\{setSettings\}\/>/);
});
