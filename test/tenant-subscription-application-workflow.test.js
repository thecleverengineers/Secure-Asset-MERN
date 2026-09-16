import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const shell = read('src/app/components/layout/AppShell.tsx');
const modulePage = read('src/app/pages/app/ModulePage.tsx');
const resourcePage = read('src/app/pages/app/ResourcePage.tsx');
const api = read('src/app/services/api.ts');
const resourceRoutes = read('server/src/routes/resourceRoutes.js');
const resourceController = read('server/src/controllers/resourceController.js');
const subscriptionController = read('server/src/controllers/subscriptionController.js');
const subscriptionRoutes = read('server/src/routes/subscriptionRoutes.js');
const lifecycle = read('server/src/services/paymentLifecycle.js');
const model = read('server/src/models/index.js');

test('tenant subscription is profile-only, tenant-owned, renewable, and history-backed', () => {
  assert.match(shell, /const tenantProfileOnlyKeys = new Set\(\['subscription', 'surveyor-subscription', 'profile'\]\)/);
  assert.match(shell, /data-secureasset-profile-subscription="my-subscription-v84"/);
  assert.match(shell, /const regularTenantFinanceMenu: MenuDef\[\] = \[\];/);
  assert.match(subscriptionController, /Subscription\.find\(\{ user: req\.user\._id \}/);
  assert.match(subscriptionController, /Subscription\.findOne\(\{ _id: req\.params\.id, user: req\.user\._id \}\)/);
  assert.match(subscriptionController, /renewalState/);
  assert.match(subscriptionRoutes, /router\.get\('\/history', subscriptionHistory\)/);
  assert.match(subscriptionRoutes, /router\.post\('\/:id\/renew', renew\)/);
  assert.match(model, /paymentHistory: \{ type: \[SubscriptionPaymentHistorySchema\]/);
  assert.match(model, /renewalHistory: \{ type: \[SubscriptionRenewalHistorySchema\]/);
  assert.match(lifecycle, /subscription\.nextRenewalAt = expiresAt/);
  assert.match(lifecycle, /subscription\.paymentHistory\.push/);
});

test('My Applications uses an applicant-only endpoint while landlord applications remain separate', () => {
  assert.match(api, /getMyTenantApplications/);
  assert.match(resourceRoutes, /router\.get\('\/applications\/mine', listTenantApplications\);/);
  assert.match(resourceRoutes, /router\.get\('\/:resource', listResources\);/);
  assert.ok(resourceRoutes.indexOf("router.get('/applications/mine'") < resourceRoutes.indexOf("router.get('/:resource'"));
  assert.match(resourceController, /applyResourceListFilters\(req, \{ applicant: req\.user\._id \}, config\)/);
  assert.match(modulePage, /module === 'my-applications' && user\?\.role === 'tenant'/);
  assert.match(modulePage, /ResourcePage resourceOverride="applications" tenantApplicationView/);
  assert.match(resourcePage, /tenantApplicationView = false/);
  assert.match(resourcePage, /getMyTenantApplications\(params\)/);
  assert.match(resourcePage, /const compactTenantApplicationView = isTenantApplications;/);
  assert.match(resourcePage, /data-secureasset-my-applications-toolbar="compact-v151"/);
  assert.match(resourcePage, /getMyTenantApplications\(params\)/);
});
