import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Payment, Tenancy } from '../server/src/models/index.js';
import { billingMonthKey, monthlyDueAt, normalizeMonthlyDueDay, normalizeMonthlyDueTime } from '../server/src/services/rentalBilling.js';

const routes = readFileSync(new URL('../server/src/routes/rentalPaymentRoutes.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../server/src/controllers/rentalPaymentController.js', import.meta.url), 'utf8');
const automation = readFileSync(new URL('../scripts/process-rental-automation.js', import.meta.url), 'utf8');
const resourcePage = readFileSync(new URL('../src/app/pages/app/ResourcePage.tsx', import.meta.url), 'utf8');
const appShell = readFileSync(new URL('../src/app/components/layout/AppShell.tsx', import.meta.url), 'utf8');
const pageHeader = readFileSync(new URL('../src/app/components/layout/PageHeader.tsx', import.meta.url), 'utf8');
const dialog = readFileSync(new URL('../src/app/components/shared/ProfessionalDialog.tsx', import.meta.url), 'utf8');
const theme = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
const designSystem = readFileSync(new URL('../src/app/designSystem.ts', import.meta.url), 'utf8');

test('monthly due schedule supports precise times and short months', () => {
  const due = monthlyDueAt(new Date(2026, 1, 12, 7, 0, 0), 31, '17:35');
  assert.equal(billingMonthKey(due), '2026-02');
  assert.equal(due.getDate(), 28);
  assert.equal(due.getHours(), 17);
  assert.equal(due.getMinutes(), 35);
  assert.equal(normalizeMonthlyDueDay(1), 1);
  assert.equal(normalizeMonthlyDueTime('09:05'), '09:05');
  assert.throws(() => normalizeMonthlyDueDay(0), /between 1 and 31/);
  assert.throws(() => normalizeMonthlyDueTime('25:00'), /HH:mm/);
});

test('rental schema protects one linked payment per invoice and stores due time', () => {
  assert.equal(Tenancy.schema.path('dueTime')?.instance, 'String');
  assert.equal(Payment.schema.path('rentalInvoice')?.options?.ref, 'RentalInvoice');
  assert.equal(Payment.schema.path('paymentVerification.status')?.instance, 'String');
  assert.ok(Payment.schema.indexes().some(([keys, options]) => keys.rentalInvoice === 1 && options?.unique && options?.name === 'payment_rental_invoice_unique'));
});

test('rental payment API requires tenant submission then landlord approval or rejection', () => {
  assert.match(routes, /router\.post\('\/invoices\/:invoiceId\/payment', submitRentalInvoicePayment\)/);
  assert.match(routes, /router\.post\('\/payments\/:paymentId\/accept', acceptRentalPayment\)/);
  assert.match(routes, /router\.post\('\/payments\/:paymentId\/reject', rejectRentalPayment\)/);
  assert.match(controller, /requireRegularTenant/);
  assert.match(controller, /requireLandlordOrAdmin/);
  assert.match(controller, /status: 'submitted'/);
  assert.match(controller, /status: 'approved'/);
  assert.match(controller, /status: 'rejected'/);
  assert.match(controller, /applyPaidPayment/);
});

test('minute-level automation issues due-date-linked payment requests', () => {
  assert.match(automation, /createMonthlyRentalInvoices/);
  assert.match(automation, /refreshRentalBillingStatuses/);
  assert.match(automation, /daysBetweenCalendarDates/);
  assert.match(readFileSync(new URL('../ecosystem.config.cjs', import.meta.url), 'utf8'), /RENT_AUTOMATION_CRON \|\| '\* \* \* \* \*'/);
});

test('dashboard UI uses configurable header, modal and semantic payment colours', () => {
  assert.match(designSystem, /navigation: '#0B5270'/);
  assert.match(designSystem, /submit: '#66752D'/);
  assert.match(designSystem, /edit: '#D97706'/);
  assert.match(designSystem, /danger: '#C74343'/);
  assert.match(appShell, /design\.colors\.navigation/);
  assert.match(pageHeader, /var\(--sa-navigation\)/);
  assert.match(dialog, /var\(--sa-navigation\)/);
  assert.match(theme, /sa-danger-button/);
  assert.match(theme, /sa-edit-button/);
  assert.match(theme, /sa-accept-button/);
  assert.match(theme, /sa-submit-button/);
  assert.match(resourcePage, /Pay rent invoice/);
  assert.match(resourcePage, /Accept rent payment/);
  assert.match(resourcePage, /Reject rent payment/);
  assert.match(resourcePage, /Monthly due time/);
});
