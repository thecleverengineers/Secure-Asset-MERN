import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(file, 'utf8');

test('UPI proof upload has a dedicated tenant-safe endpoint', () => {
  const routes = read('server/src/routes/uploadRoutes.js');
  const middleware = read('server/src/middleware/rolePermission.js');
  const controller = read('server/src/controllers/uploadController.js');
  const api = read('src/app/services/api.ts');
  const page = read('src/app/pages/app/SubscriptionPaymentPage.tsx');

  assert.match(routes, /\/subscription-payment-proof/);
  assert.match(routes, /requireSubscriptionPaymentProofUpload/);
  assert.match(middleware, /x-secureasset-upload-purpose/);
  assert.match(middleware, /module:subscription/);
  assert.match(middleware, /module:surveyor-subscription/);
  assert.match(controller, /req\.subscriptionPaymentProof/);
  assert.match(controller, /subscription_payment_proof/);
  assert.match(api, /uploadSubscriptionPaymentProof/);
  assert.match(api, /X-SecureAsset-Upload-Purpose/);
  assert.match(page, /uploadSubscriptionPaymentProof/);
  assert.doesNotMatch(page, /uploadDocument/);
});
