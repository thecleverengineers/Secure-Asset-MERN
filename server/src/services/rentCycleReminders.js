import { RentalInvoice } from '../models/index.js';
import { billingMonthKey, monthlyRentCycleBoundsForBillingMonth } from './rentalBilling.js';
import { normalizeFast2SmsWhatsAppVariables } from './fast2sms.js';
import { notifyOnce } from './notifications.js';

const DAY = 86_400_000;
const REMINDER_LEAD_DAYS = 7;
const PAYMENT_DUE_OFFSET_DAYS = 3;
const CLAIM_STALE_MS = 15 * 60_000;
const OPEN_RENT_INVOICE_STATUSES = ['upcoming', 'pending', 'partially_paid', 'overdue'];

function asDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function calendarStart(value) {
  const date = asDate(value) || new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function cycleEndKey(value) {
  const date = asDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.max(0, Number(value || 0)));
}

function dateLabel(value) {
  const date = asDate(value);
  if (!date) return 'the agreed date';
  return date.toLocaleDateString('en-IN', { dateStyle: 'long' });
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

// The approved WhatsApp copy tells the tenant the payment date. For every
// monthly invoice this is exactly three calendar days before that month's end.
export function rentCyclePaymentDueAt(cycleEndsAt) {
  const end = asDate(cycleEndsAt);
  return end ? new Date(end.getTime() - PAYMENT_DUE_OFFSET_DAYS * DAY) : null;
}

export function rentCycleReminderKey(invoice) {
  const invoiceId = objectId(invoice?._id);
  const endKey = cycleEndKey(monthlyRentCycleEnd(invoice));
  return invoiceId && endKey ? `monthly-rent-cycle-reminder-${invoiceId}-${endKey}` : '';
}

export function rentCycleReminderVariables(invoice) {
  const tenant = invoice?.tenant || {};
  const property = invoice?.property || {};
  const tenancy = invoice?.tenancy || {};
  const cycleEndsAt = monthlyRentCycleEnd(invoice);
  const dueAt = rentCyclePaymentDueAt(cycleEndsAt);
  const tenantName = String(tenant?.name || invoice?.tenantName || '').trim();
  const propertyName = String(property?.title || '').trim();
  const rentAmount = Number(invoice?.charges?.baseRent ?? invoice?.totalAmount ?? tenancy?.monthlyRent ?? property?.pricing?.monthlyRent ?? property?.price ?? 0);
  if (!tenantName || !propertyName || !dueAt || !Number.isFinite(rentAmount) || rentAmount <= 0) {
    throw new Error('Monthly rent reminder is missing the tenant, property, amount, or due date.');
  }
  // Variable order is locked to Fast2SMS template 27057:
  // Var1 tenant name | Var2 rent amount | Var3 property name | Var4 due date.
  return normalizeFast2SmsWhatsAppVariables('rent_reminder', [tenantName, money(rentAmount), propertyName, dateLabel(dueAt)]);
}

export async function queueRentCycleReminder(invoice) {
  const tenantId = objectId(invoice?.tenant);
  const tenancyId = objectId(invoice?.tenancy);
  const cycleEndsAt = monthlyRentCycleEnd(invoice);
  const key = rentCycleReminderKey(invoice);
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
      event: 'monthly_rent_cycle_due_in_seven_days',
      rentalInvoice: objectId(invoice?._id),
      tenancy: tenancyId,
      billingMonth: invoice?.billingMonth || '',
      cycleEndsAt,
      dueAt,
      whatsappTemplate: 'rent_reminder',
      whatsappVariables: variables,
    },
  });
}

export async function processRentCycleWhatsAppReminders(now = new Date(), { limit = 200 } = {}) {
  const billingMonth = billingMonthKey(now);
  const monthlyCycle = monthlyRentCycleBoundsForBillingMonth(billingMonth, now);
  if (daysUntilRentCycleEnd(now, monthlyCycle.endsAt) !== REMINDER_LEAD_DAYS) {
    return { examined: 0, eligible: 0, queued: 0, skipped: 0, failed: 0, billingMonth };
  }

  const invoices = await RentalInvoice.find({
    billingMonth,
    status: { $in: OPEN_RENT_INVOICE_STATUSES },
    balanceAmount: { $gt: 0 },
  })
    .sort({ dueDate: 1, _id: 1 })
    .limit(Math.min(Math.max(Number(limit) || 200, 1), 500))
    .populate('tenant', 'name phone status')
    .populate('property', 'title pricing price')
    .populate('tenancy', 'monthlyRent')
    .lean();

  const summary = { examined: invoices.length, eligible: 0, queued: 0, skipped: 0, failed: 0, billingMonth };
  const staleAt = new Date(now.getTime() - CLAIM_STALE_MS);

  for (const invoice of invoices) {
    const cycleEndsAt = monthlyRentCycleEnd(invoice, now);
    if (daysUntilRentCycleEnd(now, cycleEndsAt) !== REMINDER_LEAD_DAYS) {
      summary.skipped += 1;
      continue;
    }
    const key = rentCycleReminderKey(invoice);
    const dueAt = rentCyclePaymentDueAt(cycleEndsAt);
    if (!key || !dueAt) {
      summary.skipped += 1;
      continue;
    }
    summary.eligible += 1;

    // Claim before placing work on the notification queue. The unique invoice
    // / month is the recurring cycle identity, so overlapping cron workers
    // cannot queue a duplicate WhatsApp message for the same tenant.
    const claimed = await RentalInvoice.findOneAndUpdate({
      _id: invoice._id,
      billingMonth,
      status: { $in: OPEN_RENT_INVOICE_STATUSES },
      balanceAmount: { $gt: 0 },
      $or: [
        { 'rentCycleReminder.key': { $ne: key } },
        { 'rentCycleReminder.status': { $exists: false } },
        { 'rentCycleReminder.status': 'failed' },
        { 'rentCycleReminder.status': 'processing', 'rentCycleReminder.attemptedAt': { $lte: staleAt } },
      ],
    }, {
      $set: {
        cycleStartsAt: invoice.cycleStartsAt || monthlyCycle.startsAt,
        cycleEndsAt,
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
      await queueRentCycleReminder(invoice);
      await RentalInvoice.updateOne({ _id: invoice._id, 'rentCycleReminder.key': key }, {
        $set: { 'rentCycleReminder.status': 'queued', 'rentCycleReminder.queuedAt': now, 'rentCycleReminder.lastError': '' },
      });
      summary.queued += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await RentalInvoice.updateOne({ _id: invoice._id, 'rentCycleReminder.key': key }, {
        $set: { 'rentCycleReminder.status': 'failed', 'rentCycleReminder.lastError': message.slice(0, 480) },
      });
      summary.failed += 1;
    }
  }
  return summary;
}
