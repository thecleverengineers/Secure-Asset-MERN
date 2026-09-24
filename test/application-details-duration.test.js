import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { addCalendarMonthsClamped, parseAgreementDate } from '../server/src/utils/agreementDates.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('agreement end dates clamp month ends and leap days without timezone drift', () => {
  assert.equal(addCalendarMonthsClamped(parseAgreementDate('2025-01-31'), 1).toISOString(), '2025-02-28T00:00:00.000Z');
  assert.equal(addCalendarMonthsClamped(parseAgreementDate('2024-01-31'), 1).toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(addCalendarMonthsClamped(parseAgreementDate('2024-08-31'), 6).toISOString(), '2025-02-28T00:00:00.000Z');
  assert.equal(parseAgreementDate('2025-02-29'), null);
});

test('application detail route exposes secure document review, private notes, and activity actions', () => {
  const page = read('src/app/pages/app/ApplicationDetailsPage.tsx');
  const routes = read('src/app/routes.tsx');
  const controller = read('server/src/controllers/propertyManagementController.js');
  const api = read('src/app/services/api.ts');
  for (const token of ['Application list', 'Reference number', 'Property & unit', 'Applicant profile', 'Rental request', 'Supporting documents', 'Landlord notes', 'Activity history', 'Request information', 'Rejection reason']) assert.ok(page.includes(token), `detail page is missing ${token}`);
  assert.match(routes, /application_details\/:applicationId/);
  assert.match(controller, /export const getApplicationDetails/);
  assert.match(controller, /export const updateApplicationPrivateNotes/);
  assert.match(controller, /export const reviewApplicationDocument/);
  assert.match(controller, /export const streamApplicationDocument/);
  assert.match(controller, /Only the property landlord can update private application notes/);
  assert.match(controller, /Application access denied/);
  assert.match(api, /fetchApplicationDocumentBlob/);
});

test('agreement terms persist from preparation into the signed tenancy and calendar-month end date', () => {
  const agreement = read('server/src/models/agreements.js');
  const tenancy = read('server/src/models/propertyManagement.js');
  const controller = read('server/src/controllers/agreementController.js');
  const panel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
  const tenancyPage = read('src/app/pages/app/TenancyDetailsPage.tsx');
  for (const source of [agreement, tenancy]) {
    assert.match(source, /durationMonths/);
    assert.match(source, /startDate/);
    assert.match(source, /endDate/);
  }
  assert.match(controller, /Agreement duration must be a positive whole number of months/);
  assert.match(controller, /Choose a valid agreement start date/);
  assert.match(controller, /addCalendarMonthsClamped\(startDate, durationMonths\)/);
  assert.match(controller, /tenancy\.durationMonths = termMonths/);
  assert.match(controller, /request\.renewalOf/);
  assert.match(panel, /durationMonths, startDate: agreementStartDate/);
  assert.match(panel, /Prepare renewal agreement/);
  assert.match(tenancyPage, /Agreement history/);
  assert.match(tenancyPage, /Rent invoices and due dates continue monthly/);
});
