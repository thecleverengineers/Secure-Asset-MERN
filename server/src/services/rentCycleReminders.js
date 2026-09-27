import { RentalInvoice, TenantKyc } from '../models/index.js';
import { billingMonthKey, createMonthlyRentalInvoices, monthlyRentCycleBoundsForBillingMonth, refreshRentalBillingStatuses } from './rentalBilling.js';
import { normalizeFast2SmsWhatsAppVariables } from './fast2sms.js';
import { notifyOnce } from './notifications.js';
import { processNotificationQueue } from './notificationDelivery.js';

const DAY = 86_400_000;
const REMINDER_LEAD_DAYS = 7;
const PAYMENT_DUE_OFFSET_DAYS = 3;
const CLAIM_STALE_MS = 15 * 60_000;
const IST_OFFSET_MS = 330 * 60_000;
const OPEN_RENT_INVOICE_STATUSES = ['upcoming', 'pending', 'partially_paid', 'overdue'];

function asDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}
function calendarStart(value) {
  const date = asDate(value) || new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function istDateKey(value = new Date()) {
  const shifted = new Date(value.getTime() + IST_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}
function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.max(0, Number(value || 0)));
}
function dateLabel(value) {
  const date = asDate(value);
  if (!date) return 'the agreed date';
  return date.toLocaleDateString('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' });
}
function objectId(value) {
  if (!value) return '';
  return String(value?._id || value);
}

export function monthlyRentCycleEnd(invoice = {}, fallback = new Date()) {
  return asDate(invoice.cycleEndsAt) || monthlyRentCycleBoundsForBillingMonth(invoice.billingMonth || billingMonthKey(fallback), fallback).endsAt;
}
export function daysUntilRentCycleEnd(now, cycleEndsAt) {
  const current = calendarStart(now);
  const end = calendarStart(cycleEndsAt);
  return Math.round((end.getTime() - current.getTime()) / DAY);
}
export function rentCyclePaymentDueAt(cycleEndsAt) {
  const end = asDate(cycleEndsAt);
  return end ? new Date(end.getTime() - PAYMENT_DUE_OFFSET_DAYS * DAY) : null;
}
export function rentCycleReminderKey(invoice, now = new Date()) {
  const invoiceId = objectId(invoice?._id);
  return invoiceId ? `monthly-rent-cycle-reminder-${invoiceId}-${istDateKey(now)}` : '';
}
export function rentCycleReminderVariables(invoice) {
  const tenant = invoice?.tenant || {};
  const property = invoice?.property || {};
  const tenancy = invoice?.tenancy || {};
  const cycleEndsAt = monthlyRentCycleEnd(invoice);
  const dueAt = rentCyclePaymentDueAt(cycleEndsAt);
  const tenantName = String(tenant?.name || invoice?.tenantName || 'Tenant').trim() || 'Tenant';
  const propertyName = String(property?.title || invoice?.propertyName || 'your rental property').trim() || 'your rental property';
  const rentAmount = Number(invoice?.charges?.baseRent ?? invoice?.totalAmount ?? tenancy?.monthlyRent ?? property?.pricing?.monthlyRent ?? property?.price ?? 0);
  if (!dueAt || !Number.isFinite(rentAmount) || rentAmount <= 0) throw new Error('Monthly rent reminder is missing a valid rent amount or due date.');
  return normalizeFast2SmsWhatsAppVariables('rent_reminder', [tenantName, money(rentAmount), propertyName, dateLabel(dueAt)]);
}
export async function queueRentCycleReminder(invoice, now = new Date(), whatsappNumber = '') {
  const tenantId = objectId(invoice?.tenant);
  const tenancyId = objectId(invoice?.tenancy);
  const cycleEndsAt = monthlyRentCycleEnd(invoice);
  const key = rentCycleReminderKey(invoice, now);
  const dueAt = rentCyclePaymentDueAt(cycleEndsAt);
  if (!tenantId || !tenancyId || !key || !dueAt) throw new Error('Monthly rent reminder has incomplete invoice references.');
  const variables = rentCycleReminderVariables(invoice);
  return notifyOnce({
    user: tenantId,
    key,
    title: 'Rent payment reminder',
    message: `Your rent of ${variables[1]} for ${variables[2]} is due on ${variables[3]}.`,
    category: 'payment',
    actionUrl: `/app/my-property/${tenancyId}/rent-cycle`,
    metadata: {
      event: 'daily_month_end_rent_reminder',
      rentalInvoice: objectId(invoice?._id),
      tenancy: tenancyId,
      billingMonth: invoice?.billingMonth || '',
      cycleEndsAt,
      dueAt,
      reminderDate: istDateKey(now),
      whatsappTemplate: 'rent_reminder',
      whatsappVariables: variables,
      whatsappDestination: String(whatsappNumber || '').trim(),
      fast2smsMessageId: '27057',
      fast2smsPhoneNumberId: '1202480702956271',
    },
  });
}

export async function processRentCycleWhatsAppReminders(now = new Date(), { limit = 1000 } = {}) {
  const invoices = await RentalInvoice.find({
    status: { $in: OPEN_RENT_INVOICE_STATUSES },
    balanceAmount: { $gt: 0 },
  })
    .sort({ dueDate: 1, _id: 1 })
    .limit(Math.min(Math.max(Number(limit) || 1000, 1), 2000))
    .populate('tenant', 'name phone status')
    .populate('property', 'title pricing price')
    .populate('tenancy', 'monthlyRent')
    .lean();

  const tenantIds = [...new Set(invoices.map((invoice) => objectId(invoice?.tenant)).filter(Boolean))];
  const kycRows = tenantIds.length
    ? await TenantKyc.find({ user: { $in: tenantIds }, whatsappNumber: { $exists: true, $ne: '' } })
      .select('user whatsappNumber status')
      .lean()
    : [];
  const whatsappByTenant = new Map(kycRows.map((kyc) => [objectId(kyc.user), String(kyc.whatsappNumber || '').trim()]));

  const summary = { examined: invoices.length, eligible: 0, queued: 0, skipped: 0, missingWhatsapp: 0, failed: 0, billingMonth: billingMonthKey(now), reminderDate: istDateKey(now) };
  const staleAt = new Date(now.getTime() - CLAIM_STALE_MS);

  for (const invoice of invoices) {
    const cycleEndsAt = monthlyRentCycleEnd(invoice, now);
    const daysRemaining = daysUntilRentCycleEnd(now, cycleEndsAt);

    // Start seven days before the end of the monthly cycle and continue every
    // day after month-end while a balance remains. Paid invoices disappear
    // from this query immediately, which stops reminders automatically.
    if (daysRemaining > REMINDER_LEAD_DAYS) {
      summary.skipped += 1;
      continue;
    }

    const key = rentCycleReminderKey(invoice, now);
    const dueAt = rentCyclePaymentDueAt(cycleEndsAt);
    const whatsappNumber = whatsappByTenant.get(objectId(invoice?.tenant)) || '';
    if (!key || !dueAt || !whatsappNumber) {
      if (!whatsappNumber) summary.missingWhatsapp += 1;
      summary.skipped += 1;
      continue;
    }

    summary.eligible += 1;
    const claimed = await RentalInvoice.findOneAndUpdate({
      _id: invoice._id,
      status: { $in: OPEN_RENT_INVOICE_STATUSES },
      balanceAmount: { $gt: 0 },
      $or: [
        { 'rentCycleReminder.key': { $ne: key } },
        { 'rentCycleReminder.status': { $exists: false } },
        { 'rentCycleReminder.status': 'failed', 'rentCycleReminder.attemptedAt': { $lte: staleAt } },
        { 'rentCycleReminder.status': 'processing', 'rentCycleReminder.attemptedAt': { $lte: staleAt } },
      ],
    }, {
      $set: {
        'rentCycleReminder.key': key,
        'rentCycleReminder.cycleEndsAt': cycleEndsAt,
        'rentCycleReminder.dueAt': dueAt,
        'rentCycleReminder.status': 'processing',
        'rentCycleReminder.attemptedAt': now,
        'rentCycleReminder.lastError': '',
      },
    }, { new: true });

    if (!claimed) {
      summary.skipped += 1;
      continue;
    }

    try {
      await queueRentCycleReminder(invoice, now, whatsappNumber);
      await RentalInvoice.updateOne({ _id: invoice._id, 'rentCycleReminder.key': key }, {
        $set: { 'rentCycleReminder.status': 'queued', 'rentCycleReminder.queuedAt': now, 'rentCycleReminder.lastError': '' },
      });
      summary.queued += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Rent reminder queue failed', { invoiceId: String(invoice._id), tenancyId: objectId(invoice.tenancy), message });
      await RentalInvoice.updateOne({ _id: invoice._id, 'rentCycleReminder.key': key }, {
        $set: { 'rentCycleReminder.status': 'failed', 'rentCycleReminder.lastError': message.slice(0, 480) },
      });
      summary.failed += 1;
    }
  }
  return summary;
}

export function nextRentReminderRun(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  let target = new Date(Date.UTC(year, month, day, 3, 0, 0, 0)); // 08:30 Asia/Kolkata.
  if (target.getTime() <= now.getTime()) target = new Date(target.getTime() + DAY);
  return target;
}

export async function runRentReminderAutomation(now = new Date()) {
  const billing = await createMonthlyRentalInvoices(now);
  const statuses = await refreshRentalBillingStatuses(now);
  const reminders = await processRentCycleWhatsAppReminders(now);
  const delivery = await processNotificationQueue({ limit: Math.max(200, reminders.queued * 4) });
  return { billing, statuses, reminders, delivery, ranAt: now.toISOString() };
}

export function shouldRunRentReminderCatchUp(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  return minutes >= 8 * 60 + 30;
}

export function scheduleRentCycleWhatsAppReminders() {
  let timer;
  let catchUpTimer;
  let stopped = false;

  const execute = async (label) => {
    try {
      const summary = await runRentReminderAutomation(new Date());
      console.log(`${label} rent reminder run completed`, summary);
    } catch (error) {
      console.error(`${label} rent reminder run failed`, error);
    }
  };

  const scheduleNext = () => {
    if (stopped) return;
    const now = new Date();
    const target = nextRentReminderRun(now);
    timer = setTimeout(async () => {
      await execute('Daily 08:30 IST');
      scheduleNext();
    }, Math.max(1000, target.getTime() - now.getTime()));
    timer.unref?.();
  };

  // Free/ephemeral web instances may restart after 08:30 IST. Run one
  // idempotent same-day catch-up after startup; notifyOnce's daily key prevents
  // duplicate WhatsApp messages if the scheduled run already completed.
  if (shouldRunRentReminderCatchUp(new Date())) {
    catchUpTimer = setTimeout(() => void execute('Startup catch-up'), 5_000);
    catchUpTimer.unref?.();
  }

  scheduleNext();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (catchUpTimer) clearTimeout(catchUpTimer);
  };
}
