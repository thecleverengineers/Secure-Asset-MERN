import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');

test('subscription payment workflow is server verified and admin approvable', () => {
  const razorpay = read('server/src/services/razorpay.js');
  const controller = read('server/src/controllers/subscriptionPaymentController.js');
  const lifecycle = read('server/src/services/paymentLifecycle.js');
  const routes = read('server/src/routes/subscriptionPaymentRoutes.js');
  const admin = read('server/src/controllers/integrationController.js');

  assert.match(razorpay, /createRazorpayOrder/);
  assert.match(razorpay, /createHmac\('sha256'/);
  assert.match(razorpay, /verifyRazorpayWebhookSignature/);
  assert.match(razorpay, /fetchRazorpayPayment/);
  assert.match(razorpay, /RAZORPAY_WEBHOOK_SECRET/);
  assert.match(razorpay, /authorizationEncrypted/);
  assert.match(controller, /applyPaidPayment/);
  assert.match(controller, /razorpaySubscriptionWebhook/);
  assert.match(controller, /payment\.captured/);
  assert.match(controller, /order\.paid/);
  assert.match(controller, /payment\.failed/);
  assert.match(controller, /Razorpay payment amount does not match/);
  assert.match(controller, /approveManualSubscriptionPayment/);
  assert.match(controller, /approveManualSubscriptionOrder/);
  assert.match(controller, /gateway\.subscriptionId/);
  assert.match(controller, /Tenant subscription accepted and activated/);
  assert.match(controller, /manual-payment-approved/);
  assert.match(controller, /payment\.paidAmount = payableAmount/);
  assert.match(controller, /status: \{ \$in: \['pending', 'paid', 'partial'\] \}/);
  assert.match(controller, /status: 'approved'/);
  assert.match(lifecycle, /normalizeApprovedManualSubscription/);
  assert.match(lifecycle, /Payment lifecycle requires the full payable amount/);
  assert.match(routes, /router\.post\('\/admin\/:id\/approve'/);
  assert.match(routes, /router\.post\('\/admin\/subscription\/:id\/approve'/);
  assert.match(routes, /router\.post\('\/razorpay\/verify'/);
  const app = read('server/src/app.js');
  assert.match(app, /subscription-payments\/razorpay\/webhook/);
  assert.match(app, /express\.raw/);
  assert.ok(app.indexOf('subscription-payments/razorpay/webhook') < app.indexOf("express.json({ limit: '2mb' })"));
  assert.match(admin, /updateRazorpaySettings/);
});

test('subscription management exposes a dedicated tenant activation action', () => {
  const api = read('src/app/services/api.ts');
  const resourcePage = read('src/app/pages/app/ResourcePage.tsx');

  assert.match(api, /approveTenantSubscription/);
  assert.match(resourcePage, /Accept & activate tenant subscription/);
  assert.match(resourcePage, /module === 'subscriptions'/);
  assert.match(resourcePage, /config\.statuses && canEdit && module !== 'subscriptions'/);
});

test('subscription plan selection redirects to a verified Razorpay or UPI proof page', () => {
  const landlordPage = read('src/app/pages/app/SubscriptionPage.tsx');
  const surveyorPage = read('src/app/pages/app/SurveyorSubscriptionPage.tsx');
  const paymentPage = read('src/app/pages/app/SubscriptionPaymentPage.tsx');
  const routes = read('src/app/routes.tsx');
  const landlordController = read('server/src/controllers/subscriptionController.js');
  const surveyorController = read('server/src/controllers/surveyorSubscriptionController.js');
  const paymentController = read('server/src/controllers/subscriptionPaymentController.js');

  assert.match(landlordPage, /subscription-payment/);
  assert.match(surveyorPage, /subscription-payment/);
  assert.match(routes, /path: 'subscription-payment'/);
  assert.match(paymentPage, /createSubscriptionRazorpayOrder/);
  assert.match(paymentPage, /verifySubscriptionRazorpayPayment/);
  assert.match(paymentPage, /uploadSubscriptionPaymentProof/);
  assert.match(paymentPage, /transactionId/);
  assert.match(paymentPage, /Upload payment screenshot/);
  assert.match(landlordController, /Payment screenshot is required for UPI payment/);
  assert.match(surveyorController, /Payment screenshot is required for UPI payment/);
  assert.match(paymentController, /streamSubscriptionPaymentProof/);
  assert.match(paymentController, /UPI payment screenshot is required before approval/);
  assert.match(paymentController, /active image owned by the payer/);
  assert.match(landlordController, /paymentVerification: paymentMethod === 'upi'/);
  assert.match(surveyorController, /paymentVerification: paymentMethod === 'upi'/);
  assert.match(landlordPage, /Subscription history/);
  assert.match(landlordPage, /Renew subscription/);
  assert.match(landlordController, /export const subscriptionHistory/);
  assert.match(landlordController, /export const renew/);
  assert.match(landlordController, /gateway: \{ provider: 'manual', subscriptionId: subscription\._id, action: 'renewal' \}/);
  assert.match(paymentPage, /renewLandlordSubscription/);
  assert.match(paymentPage, /renewalId/);
  const landlordRoutes = read('server/src/routes/subscriptionRoutes.js');
  assert.match(landlordRoutes, /router\.get\('\/history'/);
  assert.match(landlordRoutes, /router\.post\('\/:id\/renew'/);
});

test('sidebar exposes the canonical Document Vault while the dashboard stays focused on operational work', () => {
  const dashboard = read('src/app/pages/app/RoleDashboardPage.tsx');
  const shell = read('src/app/components/layout/AppShell.tsx');
  const defaults = read('server/src/services/platformDefaults.js');
  const platform = read('server/src/services/platformConfiguration.js');

  assert.doesNotMatch(dashboard, /Document Vault/);
  assert.doesNotMatch(dashboard, /navigate\('\/app\/documents'\)/);
  assert.match(shell, /placeDocumentVaultAfterDashboard/);
  assert.match(defaults, /documents: \{ label: 'Document Vault'/);
  assert.match(platform, /'landlord-documents'/);
});

test('subscription screens use professional dialogs instead of native browser prompts', () => {
  for (const file of [
    'src/app/pages/app/SubscriptionPage.tsx',
    'src/app/pages/app/SubscriptionPaymentReviewPage.tsx',
    'src/app/pages/app/SurveyorSubscriptionPage.tsx',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /\b(?:window\.)?(?:alert|prompt|confirm)\s*\(/);
    assert.match(source, /useActionDialog/);
    assert.match(source, /actions\.dialogs/);
  }
});
