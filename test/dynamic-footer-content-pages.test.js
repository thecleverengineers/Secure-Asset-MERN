import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('required footer pages are seeded as admin-managed content pages', () => {
  const defaults = read('server/src/services/platformDefaults.js');
  for (const token of [
    "Terms and Conditions", "/terms-and-conditions",
    "Privacy Policy", "/privacy-policy",
    "Shipping Policy", "/shipping-policy",
    "Contact Us", "/contact",
    "Cancellation and Refunds", "/cancellation-and-refunds",
  ]) assert.ok(defaults.includes(token), `missing ${token}`);
  assert.match(defaults, /footer: \{ enabled: true, label: 'Terms and Conditions', sortOrder: 10 \}/);
  assert.match(defaults, /footer: \{ enabled: true, label: 'Cancellation and Refunds', sortOrder: 50 \}/);
});

test('content page admin can control footer visibility label and order', () => {
  const model = read('server/src/models/propertyManagement.js');
  const resources = read('server/src/services/resources.js');
  const page = read('src/app/pages/app/ResourcePage.tsx');
  assert.match(model, /footer: \{/);
  assert.match(model, /sortOrder: \{ type: Number/);
  assert.match(resources, /'visibility', 'footer', 'active'/);
  assert.match(page, /name:'footer\.enabled',label:'Show in footer'/);
  assert.match(page, /name:'footer\.label',label:'Footer label'/);
  assert.match(page, /name:'footer\.sortOrder',label:'Footer order'/);
});

test('public footer links are read dynamically from published content pages', () => {
  const controller = read('server/src/controllers/siteController.js');
  const layout = read('src/app/components/FrontLayout.tsx');
  const platform = read('server/src/services/platformConfiguration.js');
  assert.match(controller, /'footer\.enabled': true/);
  assert.match(controller, /footerPages/);
  assert.match(controller, /'footer\.sortOrder': 1/);
  assert.match(layout, /footerPages/);
  assert.match(layout, /page\?\.footer\?\.label \|\| page\?\.title/);
  assert.match(platform, /\/terms-of-service/);
  assert.match(platform, /active: false, 'footer\.enabled': false/);
});
