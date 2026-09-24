import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('tenancy records open a dedicated detail route with the four requested sections', async () => {
  const [routes, records, page] = await Promise.all([
    source('src/app/routes.tsx'),
    source('src/app/pages/app/ResourcePage.tsx'),
    source('src/app/pages/app/TenancyDetailsPage.tsx'),
  ]);
  assert.match(routes, /path: 'tenancy_details\/:tenancyId', Component: TenancyDetailsPage/);
  assert.match(records, /navigate\(`\/app\/tenancy_details\/\$\{encodeURIComponent\(row\._id\)\}`\)/);
  for (const label of ['Overview', 'Rent & Payments', 'Agreement & Documents', 'Activity']) assert.ok(page.includes(label), `missing tenancy tab: ${label}`);
  for (const detail of ['Monthly rent', 'Security deposit', 'Next due date', 'Overdue balance', 'Tenant email', 'Move-in date']) assert.ok(page.includes(detail), `missing tenancy detail: ${detail}`);
});

test('tenancy detail actions use permission-aware flows and confirm tenancy closure', async () => {
  const [page, controller, routes, resources, paymentModel] = await Promise.all([
    source('src/app/pages/app/TenancyDetailsPage.tsx'),
    source('server/src/controllers/rentalUnitController.js'),
    source('server/src/routes/propertyManagementRoutes.js'),
    source('server/src/controllers/resourceController.js'),
    source('server/src/models/index.js'),
  ]);
  assert.match(page, /actions\.askConfirmation\(prompt, \{ title: isFinalStep \? 'Close tenancy'/);
  assert.match(page, /permissions\?\.canManage/);
  assert.match(page, /sendTenancyRentReminder\(tenancyId, idOf\(invoice\)\)/);
  assert.match(page, /recordTenancyPayment\(tenancyId/);
  assert.match(controller, /buildScope\(user, 'tenancies'\)/);
  assert.match(controller, /amount > balance/);
  assert.match(controller, /event: 'rent_reminder_sent'/);
  assert.match(controller, /source: 'landlord_recorded_offline_payment'/);
  assert.match(controller, /invoice\.payments\.push\(\{ payment: payment\._id/);
  assert.match(controller, /RentCycle\.updateOne\(\{ _id: invoice\.rentCycle \}/);
  assert.doesNotMatch(controller.slice(controller.indexOf('export const recordTenancyPayment'), controller.indexOf('function moneyForRentPayment')), /rentalInvoice: invoice\._id/);
  assert.match(paymentModel, /PaymentSchema\.index\(\{ rentalInvoice: 1 \}, \{ unique: true/);
  assert.match(resources, /Landlord-recorded rent payments are immutable/);
  assert.match(resources, /Landlord-recorded rent payments cannot be deleted/);
  assert.match(routes, /\/tenancies\/:tenancyId\/details/);
  assert.match(routes, /\/tenancies\/:tenancyId\/reminders/);
  assert.match(routes, /\/tenancies\/:tenancyId\/payments/);
});
