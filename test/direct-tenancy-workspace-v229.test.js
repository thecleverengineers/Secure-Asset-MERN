import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('tenancies page opens the dedicated direct tenancy workspace', () => {
  const resourcePage = read('src/app/pages/app/ResourcePage.tsx');
  const routes = read('src/app/routes.tsx');
  assert.match(resourcePage, /navigate\('\/app\/add\/tenancy'\)/);
  assert.match(resourcePage, />Add tenancy</);
  assert.match(routes, /path: 'add\/tenancy', Component: AddTenancyPage/);
});

test('direct tenancy options include landlord-added and tenancy-holder tenants while listings/rooms stay owner-scoped', () => {
  const controller = read('server/src/controllers/rentalUnitController.js');
  assert.match(controller, /createdBy: landlordId/);
  assert.match(controller, /invitationStatus: 'registered'/);
  assert.match(controller, /Tenancy\.find\(\{/);
  assert.match(controller, /landlord: landlordId/);
  assert.match(controller, /isTenancyHolder = true/);
  assert.match(controller, /!ownAddedContact && !holderTenancy/);
  assert.match(controller, /owner: landlordId/);
  assert.match(controller, /status: \{ \$in: \['available', 'partially_occupied'\] \}/);
  assert.match(controller, /\$or: \[\{ listingType: 'rent' \}, \{ purpose: 'rent' \}\]/);
  assert.match(controller, /availabilityStatus: 'AVAILABLE'/);
  assert.match(controller, /currentTenancyId: null/);
  assert.match(controller, /currentTenantId: null/);
});

test('direct tenancy creation occupies the selected room and joins rental billing', () => {
  const controller = read('server/src/controllers/rentalUnitController.js');
  const lifecycle = read('server/src/services/rentalUnitLifecycle.js');
  assert.match(controller, /export const createDirectTenancy/);
  assert.match(controller, /status: 'active'/);
  assert.match(controller, /transitionRentalUnit\(unit, 'OCCUPIED'/);
  assert.match(controller, /ensureMonthlyRentalInvoice\(tenancy, now\)/);
  assert.match(controller, /ensureRentalInvoicePayment\(initialInvoice, tenancy, now\)/);
  assert.match(lifecycle, /AVAILABLE: \['APPLICATION_PENDING', 'RESERVED', 'OCCUPIED'/);
});
