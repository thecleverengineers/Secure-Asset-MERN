import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  daysUntilRentCycleEnd,
  rentCyclePaymentDueAt,
  rentCycleReminderKey,
  rentCycleReminderVariables,
} from '../server/src/services/rentCycleReminders.js';
import { billingMonthKey, monthlyRentCycleBounds, monthlyRentCycleBoundsForBillingMonth } from '../server/src/services/rentalBilling.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const dashboardController = read('server/src/controllers/dashboardController.js');
const dashboardRoutes = read('server/src/routes/dashboardRoutes.js');
const myPropertyPage = read('src/app/pages/app/MyPropertyPage.tsx');
const rentCyclePage = read('src/app/pages/app/MyRentCyclePage.tsx');
const appRoutes = read('src/app/routes.tsx');
const scheduler = read('scripts/process-rental-automation.js');
const reminderService = read('server/src/services/rentCycleReminders.js');
const rentalModel = read('server/src/models/propertyManagement.js');
const rentalBilling = read('server/src/services/rentalBilling.js');

test('tenant rent-cycle timing uses seven calendar days for the reminder and a due date three days before cycle end', () => {
  const now = new Date(2026, 8, 13, 10, 0, 0);
  const cycleEndsAt = new Date(2026, 8, 20, 9, 0, 0);
  assert.equal(daysUntilRentCycleEnd(now, cycleEndsAt), 7);
  const dueAt = rentCyclePaymentDueAt(cycleEndsAt);
  assert.equal(dueAt?.getFullYear(), 2026);
  assert.equal(dueAt?.getMonth(), 8);
  assert.equal(dueAt?.getDate(), 17);
});

test('each rent cycle uses its own calendar month, including leap-year month boundaries', () => {
  const february = monthlyRentCycleBounds(new Date(2028, 1, 14, 18, 45));
  assert.equal(billingMonthKey(new Date(2028, 1, 14)), '2028-02');
  assert.equal(february.startsAt.toISOString(), new Date(2028, 1, 1).toISOString());
  assert.equal(february.endsAt.toISOString(), new Date(2028, 2, 1).toISOString());
  const december = monthlyRentCycleBoundsForBillingMonth('2028-12');
  assert.equal(december.startsAt.toISOString(), new Date(2028, 11, 1).toISOString());
  assert.equal(december.endsAt.toISOString(), new Date(2029, 0, 1).toISOString());
});

test('approved Fast2SMS template 27057 receives the tenant name, rent, property and due date in the required order', () => {
  const request = {
    _id: 'invoice-1',
    billingMonth: '2026-09',
    cycleEndsAt: new Date(2026, 8, 20, 9, 0, 0),
    tenant: { _id: 'tenant-1', name: 'Asha Devi' },
    property: { title: 'Green Valley Apartment', pricing: { monthlyRent: 18000 } },
    tenancy: { _id: 'tenancy-1', monthlyRent: 18000 },
  };
  assert.equal(rentCycleReminderKey(request), 'monthly-rent-cycle-reminder-invoice-1-2026-09-20');
  const variables = rentCycleReminderVariables(request);
  assert.equal(variables.length, 4);
  assert.equal(variables[0], 'Asha Devi');
  assert.equal(variables[1], '₹18,000');
  assert.equal(variables[2], 'Green Valley Apartment');
  assert.match(variables[3], /17/);
});

test('rent-cycle page and API remain tenant scoped, text-first, and tied to the active monthly invoice', () => {
  assert.match(dashboardRoutes, /router\.get\('\/my-properties\/:tenancyId\/rent-cycle', authenticate, myPropertyRentCycle\)/);
  assert.match(dashboardController, /_id: req\.params\.tenancyId,\s*tenant: req\.user\._id,/);
  assert.match(dashboardController, /AgreementRequest\.findOne/);
  assert.match(dashboardController, /RentalInvoice\.find\(\{ tenancy: tenancy\._id, tenant: req\.user\._id \}\)/);
  assert.match(dashboardController, /const activeBillingMonth = billingMonthKey\(now\)/);
  assert.match(dashboardController, /const cycleMonth = activeBillingMonth/);
  assert.match(dashboardController, /monthlyRentCycleBoundsForBillingMonth\(activeBillingMonth, now\)/);
  assert.match(dashboardController, /termMonths: 1/);
  assert.match(myPropertyPage, /data-secureasset-my-property-cycle-card="text-first-v164"/);
  assert.doesNotMatch(myPropertyPage, /OptimizedImage/);
  assert.match(rentCyclePage, /data-secureasset-my-rent-cycle="tenant-rent-payment-history-v221"/);
  assert.match(rentCyclePage, /Time left in this monthly rent cycle/);
  assert.doesNotMatch(rentCyclePage, /OptimizedImage/);
  assert.match(rentCyclePage, /fetchAgreementPreviewBlob/);
  assert.match(appRoutes, /path: 'my-property\/:tenancyId\/rent-cycle', Component: MyRentCyclePage/);
});

test('rental automation creates one protected invoice per tenancy/month and claims each monthly WhatsApp reminder once', () => {
  assert.match(scheduler, /processRentCycleWhatsAppReminders/);
  assert.match(scheduler, /createMonthlyRentalInvoices/);
  for (const phrase of [
    'REMINDER_LEAD_DAYS = 7',
    'PAYMENT_DUE_OFFSET_DAYS = 3',
    'RentalInvoice.findOneAndUpdate',
    'monthly_rent_cycle_due_in_seven_days',
    'billingMonth',
    "'rentCycleReminder.status': 'processing'",
    "'rentCycleReminder.status': 'queued'",
    "whatsappTemplate: 'rent_reminder'",
    'normalizeFast2SmsWhatsAppVariables',
    'notifyOnce',
  ]) assert.ok(reminderService.includes(phrase), `missing secured reminder control: ${phrase}`);
  for (const phrase of ['monthlyRentCycleBounds', 'ensureMonthlyRentalInvoice', 'cycleStartsAt', 'cycleEndsAt']) assert.ok(rentalBilling.includes(phrase), `missing recurring invoice control: ${phrase}`);
  for (const phrase of ['RentalInvoiceSchema.index({ tenancy: 1, billingMonth: 1 }, { unique: true })', 'rentCycleReminder:', "status: { type: String, enum: ['processing', 'queued', 'failed'] }"]) assert.ok(rentalModel.includes(phrase), `missing invoice reminder state: ${phrase}`);
});


test('tenant rent-cycle page exposes monthly payment submission and verification status', () => {
  assert.match(dashboardController, /rentInvoicePayload\(invoice, payment = null\)/);
  assert.match(dashboardController, /'gateway\.source': 'rental_invoice'/);
  assert.match(dashboardController, /verificationStatus: verification\.status \|\| 'awaiting_tenant'/);
  assert.match(dashboardController, /paymentByInvoice/);
  assert.match(rentCyclePage, /data-secureasset-rent-payment="tenant-pay-and-status-v221"/);
  assert.match(rentCyclePage, /submitRentalInvoicePayment/);
  assert.match(rentCyclePage, /Pay Rent/);
  assert.match(rentCyclePage, /Awaiting landlord approval/);
  assert.match(rentCyclePage, /Payment rejected/);
  assert.match(rentCyclePage, /Submit Rent Payment/);
  assert.match(rentCyclePage, /monthText\(item\.billingMonth\)/);
});
