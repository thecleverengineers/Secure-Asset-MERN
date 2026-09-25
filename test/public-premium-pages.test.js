import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('public premium pages share SecureAsset visual framing', () => {
  const surveyors = read('src/app/pages/SurveyorMarketplacePage.tsx');
  const publicPages = read('src/app/pages/PublicPages.tsx');
  assert.match(surveyors, /sa-surveyor-directory/);
  assert.match(publicPages, /sa-about-premium/);
  assert.match(publicPages, /sa-pricing-premium/);
  assert.match(publicPages, /Open Sans|pricing-premium\.css/);
});

test('pricing sends an authenticated tenant directly to subscription payment', () => {
  const publicPages = read('src/app/pages/PublicPages.tsx');
  assert.match(publicPages, /user\?\.role === 'tenant'/);
  assert.match(publicPages, /\/app\/subscription-payment\?/);
  assert.match(publicPages, /type: tab/);
  assert.match(publicPages, /plan: String\(plan\.key/);
  assert.match(publicPages, /navigate\(paymentPath\)/);
  assert.match(publicPages, /\/login\?mode=register&redirect=/);
});
