import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const controller = read('server/src/controllers/dashboardController.js');
const routes = read('server/src/routes/dashboardRoutes.js');
const api = read('src/app/services/api.ts');
const shell = read('src/app/components/layout/AppShell.tsx');
const modulePage = read('src/app/pages/app/ModulePage.tsx');
const page = read('src/app/pages/app/MyPropertyPage.tsx');

test('tenant My Property endpoint returns rented, leased and purchased records from the signed-in tenant scope', () => {
  assert.match(routes, /router\.get\('\/my-properties', authenticate, myProperties\)/);
  assert.match(controller, /if \(req\.user\.role !== 'tenant'\)/);
  assert.match(controller, /Tenancy\.find\(\{ tenant: tenantId/);
  assert.match(controller, /Tenant\.find\(\{ user: tenantId/);
  assert.match(controller, /Lease\.find\(\{ tenant: tenantId/);
  assert.match(controller, /Payment\.find\(\{ payer: tenantId, type: 'sale', status: 'paid'/);
  assert.match(controller, /data: \{\s*rented,\s*leased,\s*purchased/);
});

test('agreement-pending property stays hidden until first-party approval activates the tenancy', () => {
  assert.match(controller, /const activeTenancyStatuses = \['payment_pending', 'active', 'notice', 'move_out'\]/);
  assert.doesNotMatch(controller, /const activeTenancyStatuses = \[[^\]]*agreement_pending/);
  assert.match(controller, /approvedRentTenancies/);
  assert.match(controller, /approvedLeaseTenancies/);
  assert.match(controller, /record\.property\?\.purpose \|\| record\.property\?\.listingType/);
});

test('tenant sidebar keeps My Property while the profile menu owns subscription access', () => {
  assert.match(api, /export async function getMyProperties\(\)/);
  assert.match(shell, /const regularTenantPropertyMenu/);
  assert.match(shell, /path: '\/app\/my-property'/);
  assert.match(shell, /getMySubscription\(\), getMySurveyorSubscription\(\)/);
  assert.match(shell, /showTenantUpgrade/);
  assert.match(shell, /Upgrade account/);
  assert.match(shell, /data-secureasset-profile-subscription="my-subscription-v84"/);
  assert.match(shell, />My subscription<\/MenuItem>/);
  assert.match(shell, /Surveyor subscription/);
});

test('My Property page provides private rented, leased and purchased views', () => {
  assert.match(modulePage, /module === 'my-property' && user\?\.role === 'tenant'/);
  assert.match(page, /const tabs = \[/);
  for (const label of ['Rented', 'Leased', 'Purchased', 'Private to you', 'getMyProperties']) assert.match(page, new RegExp(label));
});


test('security-deposit approval exposes the exact tenant rent record in My Property without marking monthly rent paid', () => {
  const agreement = read('server/src/controllers/agreementController.js');
  assert.match(agreement, /securityDepositPayment\.status = 'paid'/);
  assert.match(agreement, /securityDepositPayment\.paidAmount = requiredDepositAmount/);
  assert.match(agreement, /paymentVerification = \{[\s\S]*status: 'approved'/);
  assert.match(controller, /'payment_pending', 'active', 'notice', 'move_out'/);
  assert.match(controller, /Payment\.find\(\{[\s\S]*type: 'deposit',[\s\S]*status: 'paid'/);
  assert.match(controller, /rentRecord: cycleRecord \?/);
  assert.match(page, /data-secureasset-my-property-rent-record="tenant-specific-v220"/);
  assert.match(page, /Security deposit/);
  assert.match(page, /Rent invoice/);
});
