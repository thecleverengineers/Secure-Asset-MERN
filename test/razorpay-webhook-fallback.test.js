import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');

test('Razorpay webhook fallback is signed, raw-body based and idempotent', () => {
  const app = read('server/src/app.js');
  const service = read('server/src/services/razorpay.js');
  const controller = read('server/src/controllers/subscriptionPaymentController.js');
  const env = read('server/src/config/env.js');

  assert.match(env, /RAZORPAY_WEBHOOK_SECRET/);
  assert.match(app, /express\.raw\(\{ type: 'application\/json'/);
  assert.ok(app.indexOf('subscription-payments/razorpay/webhook') < app.indexOf("express.json({ limit: '2mb' })"));
  assert.match(service, /verifyRazorpayWebhookSignature/);
  assert.match(service, /timingSafeEqual/);
  assert.match(service, /webhookSecretEncrypted/);
  assert.match(controller, /x-razorpay-signature/);
  assert.match(controller, /x-razorpay-event-id/);
  assert.match(controller, /webhookEventIds/);
  assert.match(controller, /fetchRazorpayPayment/);
  assert.match(controller, /remotePayment\.status !== 'captured'/);
  assert.match(controller, /remoteAmount !== expectedAmount/);
  assert.match(controller, /applyPaidPayment/);
});

test('Razorpay webhook secret is independently configurable from API key secret', () => {
  const model = read('server/src/models/propertyManagement.js');
  const integration = read('server/src/controllers/integrationController.js');
  const api = read('src/app/services/api.ts');

  assert.match(model, /webhookSecretEncrypted/);
  assert.match(integration, /webhookSecret/);
  assert.match(integration, /webhookSecretChanged/);
  assert.match(api, /webhookSecret\?: string/);
});
