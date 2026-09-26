import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('tenant rent payment proof access is authorized by invoice ownership, not module permission', () => {
  const permission = read('server/src/middleware/rolePermission.js');
  assert.match(permission, /requireRentalPaymentProofUpload/);
  assert.match(permission, /RentalInvoice\.findOne\(\{ _id: invoiceId, tenant: req\.user\._id \}\)/);
  assert.doesNotMatch(permission, /featureAllowed\('module:rental-invoices', req\.user, 'view'\)/);
});

test('rent payment submission router relies on endpoint ownership checks, not generic rental-invoices module access', () => {
  const routes = read('server/src/routes/rentalPaymentRoutes.js');
  const controller = read('server/src/controllers/rentalPaymentController.js');
  assert.match(routes, /router\.use\(authenticate\)/);
  assert.doesNotMatch(routes, /requireFeaturePermission\('module:rental-invoices'\)/);
  assert.match(controller, /RentalInvoice\.findOne\(\{ _id: req\.params\.invoiceId, tenant: req\.user\._id \}\)/);
  assert.match(controller, /Tenancy\.findOne\(\{ _id: invoice\.tenancy, tenant: req\.user\._id, landlord: invoice\.landlord \}\)/);
});
