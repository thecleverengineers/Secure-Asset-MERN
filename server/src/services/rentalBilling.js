import { Payment, RentCycle, RentalInvoice, RentalUnit, Subscription, Tenancy } from '../models/index.js';

const DAY = 86_400_000;
const ACTIVE_TENANCY_STATUSES = ['active'];
const OPEN_INVOICE_STATUSES = ['upcoming', 'pending', 'partially_paid', 'overdue'];
const OPEN_PAYMENT_STATUSES = ['pending', 'partial', 'overdue'];

export function billingMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// A rent cycle is always the current calendar month. The end is the first
// instant of the following month, which makes the countdown and invoice
// generation deterministic even in short months and leap years.
export function monthlyRentCycleBounds(date = new Date()) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) throw new RangeError('Rent-cycle date is invalid.');
  return {
    startsAt: new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0),
    endsAt: new Date(value.getFullYear(), value.getMonth() + 1, 1, 0, 0, 0, 0),
  };
}

export function monthlyRentCycleBoundsForBillingMonth(billingMonth, fallback = new Date()) {
  const match = String(billingMonth || '').match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return monthlyRentCycleBounds(fallback);
  return monthlyRentCycleBounds(new Date(Number(match[1]), Number(match[2]) - 1, 1));
}

export function normalizeMonthlyDueDay(value = 1) {
  const dueDay = Number(value);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new RangeError('Monthly due day must be a whole number between 1 and 31.');
  }
  return dueDay;
}

export function normalizeMonthlyDueTime(value = '09:00') {
  const dueTime = String(value || '09:00').trim();
  const match = dueTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new RangeError('Monthly due time must use HH:mm in 24-hour time.');
  return `${match[1]}:${match[2]}`;
}

// The server's configured timezone defines the tenancy's billing timezone.
// Clamp months such as February so a due day of 31 remains valid each month.
export function monthlyDueAt(date = new Date(), dueDay = 1, dueTime = '09:00') {
  const day = normalizeMonthlyDueDay(dueDay);
  const [hours, minutes] = normalizeMonthlyDueTime(dueTime).split(':').map(Number);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return new Date(date.getFullYear(), date.getMonth(), Math.min(day, lastDay), hours, minutes, 0, 0);
}

export function rentalInvoiceNumber(tenancy, month, rentalUnit = null) {
  const room = String(rentalUnit?.roomNumber || '').trim().replace(/[^a-z0-9-]/gi, '').toUpperCase();
  return room
    ? `RNT-${room}-${String(month).replace('-', '')}-${String(tenancy._id).slice(-6).toUpperCase()}`
    : `RNT-${String(month).replace('-', '')}-${String(tenancy._id).slice(-7).toUpperCase()}`;
}

export function rentalPaymentNumber(invoice) {
  return `${invoice.invoiceNumber}-PAY`;
}

export function calculateRentalInvoiceTotal(invoice = {}) {
  const charges = invoice.charges?.toObject?.() || invoice.charges || {};
  const other = (charges.other || []).reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  const chargeKeys = ['baseRent', 'electricity', 'water', 'maintenance', 'parking', 'internet', 'gas', 'cleaning', 'commonArea', 'securityDeposit', 'lateFee'];
  const subtotal = chargeKeys.reduce((sum, key) => sum + Number(charges[key] || 0), 0) + other;
  return Math.max(0, subtotal + Number(invoice.previousBalance || 0) - Number(invoice.discounts || 0));
}

function paymentStatusFor(invoice, now) {
  if (Number(invoice.balanceAmount || 0) <= 0) return 'paid';
  return new Date(invoice.dueDate) < now ? 'overdue' : 'pending';
}

async function createInvoiceSafely(tenancy, month, now, rentalUnit = null, { initial = false } = {}) {
  const cycle = monthlyRentCycleBoundsForBillingMonth(month, now);
  const dueDate = monthlyDueAt(cycle.startsAt, tenancy.dueDay || 1, tenancy.dueTime || '09:00');
  const baseRent = Math.max(0, Number(tenancy.monthlyRent || rentalUnit?.pricing?.monthlyRent || 0));
  const maintenance = Math.max(0, Number(tenancy.maintenanceCharge || rentalUnit?.pricing?.maintenanceCharge || 0));
  const securityDeposit = initial ? Math.max(0, Number(tenancy.securityDeposit || rentalUnit?.pricing?.securityDeposit || 0)) : 0;
  const bookingAmount = initial ? Math.max(0, Number(tenancy.bookingAmount || rentalUnit?.pricing?.bookingAmount || 0)) : 0;
  const totalAmount = baseRent + maintenance + securityDeposit + bookingAmount;
  const payload = {
    invoiceNumber: rentalInvoiceNumber(tenancy, month, rentalUnit),
    tenancy: tenancy._id,
    tenant: tenancy.tenant,
    landlord: tenancy.landlord,
    property: tenancy.property,
    space: tenancy.space,
    rentalUnit: rentalUnit?._id || tenancy.rentalUnit,
    billingMonth: month,
    cycleStartsAt: cycle.startsAt,
    cycleEndsAt: cycle.endsAt,
    dueDate,
    charges: { baseRent, electricity: 0, water: 0, maintenance, parking: 0, internet: 0, gas: 0, cleaning: 0, commonArea: 0, securityDeposit, lateFee: 0, other: bookingAmount > 0 ? [{ label: 'Booking amount', amount: bookingAmount }] : [] },
    discounts: 0,
    previousBalance: 0,
    totalAmount,
    paidAmount: 0,
    balanceAmount: totalAmount,
    status: dueDate < now ? 'overdue' : 'pending',
    createdBy: tenancy.landlord,
    updatedBy: tenancy.landlord,
  };
  try {
    return { invoice: await RentalInvoice.create(payload), created: true };
  } catch (error) {
    // The tenancy/month unique index makes concurrent cron workers safe. If a
    // second worker won the race, continue with the record it just created.
    if (error?.code !== 11000) throw error;
    const invoice = await RentalInvoice.findOne({ tenancy: tenancy._id, billingMonth: month });
    if (!invoice) throw error;
    return { invoice, created: false };
  }
}

async function ensureRentCycle(invoice, tenancy, now = new Date()) {
  if (!tenancy.rentalUnit && !invoice.rentalUnit) return null;
  const cycle = monthlyRentCycleBoundsForBillingMonth(invoice.billingMonth, now);
  const amount = Math.max(0, Number(invoice.totalAmount || 0));
  const paidAmount = Math.max(0, Number(invoice.paidAmount || 0));
  const status = invoice.status === 'partially_paid' ? 'partial' : invoice.status;
  const rentCycle = await RentCycle.findOneAndUpdate(
    { tenancy: tenancy._id, cycleMonth: invoice.billingMonth },
    { $set: {
      property: tenancy.property,
      rentalUnit: invoice.rentalUnit || tenancy.rentalUnit,
      landlord: tenancy.landlord,
      tenant: tenancy.tenant,
      startsAt: invoice.cycleStartsAt || cycle.startsAt,
      endsAt: invoice.cycleEndsAt || cycle.endsAt,
      dueAt: invoice.dueDate,
      invoice: invoice._id,
      amount,
      paidAmount,
      outstandingAmount: Math.max(0, amount - paidAmount),
      status: ['upcoming', 'pending', 'partial', 'paid', 'overdue', 'waived'].includes(status) ? status : 'pending',
      updatedBy: tenancy.landlord,
    }, $setOnInsert: { createdBy: tenancy.landlord } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (!invoice.rentCycle || String(invoice.rentCycle) !== String(rentCycle._id)) {
    invoice.rentCycle = rentCycle._id;
    await invoice.save({ validateModifiedOnly: true });
  }
  return rentCycle;
}

export async function ensureMonthlyRentalInvoice(tenancy, now = new Date()) {
  const month = billingMonthKey(now);
  const rentalUnit = tenancy.rentalUnit
    ? (tenancy.rentalUnit?.roomNumber ? tenancy.rentalUnit : await RentalUnit.findById(tenancy.rentalUnit).select('roomNumber pricing'))
    : null;
  let invoice = await RentalInvoice.findOne({ tenancy: tenancy._id, billingMonth: month });
  let created = false;
  if (!invoice) ({ invoice, created } = await createInvoiceSafely(tenancy, month, now, rentalUnit));

  // Legacy/manual invoices can predate the normalised totals. Keep their
  // owner-entered amounts, only repairing derived fields when they are absent.
  const cycle = monthlyRentCycleBoundsForBillingMonth(invoice.billingMonth || month, now);
  if (invoice.totalAmount === undefined || invoice.balanceAmount === undefined) {
    invoice.totalAmount = calculateRentalInvoiceTotal(invoice);
    invoice.balanceAmount = Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0));
    invoice.status = Number(invoice.balanceAmount || 0) <= 0 ? 'paid' : paymentStatusFor(invoice, now);
    invoice.updatedBy = tenancy.landlord;
    await invoice.save({ validateModifiedOnly: true });
  }
  if (!invoice.cycleStartsAt || !invoice.cycleEndsAt) {
    invoice.cycleStartsAt = cycle.startsAt;
    invoice.cycleEndsAt = cycle.endsAt;
    invoice.paymentCycle = 'monthly';
    invoice.updatedBy = tenancy.landlord;
    await invoice.save({ validateModifiedOnly: true });
  }
  const rentCycle = await ensureRentCycle(invoice, tenancy, now);
  return { invoice, rentCycle, created };
}

export async function ensureInitialRentalInvoice(tenancy, rentalUnit, now = new Date()) {
  const month = billingMonthKey(now);
  let invoice = await RentalInvoice.findOne({ tenancy: tenancy._id, billingMonth: month });
  let created = false;
  if (!invoice) ({ invoice, created } = await createInvoiceSafely(tenancy, month, now, rentalUnit, { initial: true }));
  const rentCycle = await ensureRentCycle(invoice, tenancy, now);
  await ensureRentalInvoicePayment(invoice, tenancy, now);
  return { invoice, rentCycle, created };
}

export async function ensureRentalInvoicePayment(invoice, tenancy, now = new Date()) {
  const amount = Math.max(0, Number(invoice.balanceAmount ?? invoice.totalAmount ?? 0));
  let payment = await Payment.findOne({ rentalInvoice: invoice._id });
  if (!payment && amount <= 0) return { payment: null, created: false };

  if (!payment) {
    const payload = {
      invoiceNumber: rentalPaymentNumber(invoice),
      rentalInvoice: invoice._id,
      payer: invoice.tenant || tenancy.tenant,
      payee: invoice.landlord || tenancy.landlord,
      property: invoice.property || tenancy.property,
      rentalUnit: invoice.rentalUnit || tenancy.rentalUnit,
      tenancy: tenancy._id,
      lease: tenancy.lease,
      type: 'rent',
      amount,
      paidAmount: 0,
      status: paymentStatusFor(invoice, now),
      dueDate: invoice.dueDate,
      method: 'offline',
      gateway: { source: 'rental_invoice', approvalRequired: 'landlord', rentalInvoiceNumber: invoice.invoiceNumber },
      paymentVerification: { status: 'awaiting_tenant', submissionCount: 0 },
      notes: `Rent due for ${invoice.billingMonth} · ${invoice.invoiceNumber}`,
      createdBy: invoice.landlord || tenancy.landlord,
      updatedBy: invoice.landlord || tenancy.landlord,
    };
    try {
      payment = await Payment.create(payload);
      return { payment, created: true };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      payment = await Payment.findOne({ rentalInvoice: invoice._id });
      if (!payment) throw error;
    }
  }

  const stage = payment.paymentVerification?.status;
  if (!['paid', 'refunded', 'waived'].includes(payment.status) && ['awaiting_tenant', 'rejected', undefined].includes(stage)) {
    payment.amount = amount;
    payment.dueDate = invoice.dueDate;
    payment.property = invoice.property || tenancy.property;
    payment.payee = invoice.landlord || tenancy.landlord;
    payment.payer = invoice.tenant || tenancy.tenant;
    payment.status = paymentStatusFor(invoice, now);
    payment.paymentVerification ||= { status: 'awaiting_tenant', submissionCount: 0 };
    payment.paymentVerification.status ||= 'awaiting_tenant';
    payment.updatedBy = invoice.landlord || tenancy.landlord;
    await payment.save({ validateModifiedOnly: true });
  }
  return { payment, created: false };
}

export async function createMonthlyRentalInvoices(now = new Date()) {
  const activeOwners = await Subscription.distinct('user', {
    status: 'active',
    expiresAt: { $gt: now },
    'limits.rentAutomation': true,
  });
  const tenancies = await Tenancy.find({
    landlord: { $in: activeOwners },
    status: { $in: ACTIVE_TENANCY_STATUSES },
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $gte: now } }, { endDate: { $exists: false } }],
  }).lean();

  let createdInvoices = 0;
  let createdPayments = 0;
  for (const tenancy of tenancies) {
    const { invoice, created } = await ensureMonthlyRentalInvoice(tenancy, now);
    const { payment, created: paymentCreated } = await ensureRentalInvoicePayment(invoice, tenancy, now);
    // The approved Fast2SMS rent_reminder template is scheduled from this
    // invoice's monthly cycle seven calendar days before the month ends,
    // rather than when the bookkeeping invoice happens to be created.
    if (created) createdInvoices += 1;
    if (paymentCreated) createdPayments += 1;
  }
  return { createdInvoices, createdPayments, tenancyCount: tenancies.length };
}

export async function refreshRentalBillingStatuses(now = new Date()) {
  const [invoices, payments, settled] = await Promise.all([
    RentalInvoice.updateMany({ status: { $in: OPEN_INVOICE_STATUSES }, dueDate: { $lt: now }, balanceAmount: { $gt: 0 } }, { $set: { status: 'overdue' } }),
    Payment.updateMany({ rentalInvoice: { $exists: true }, status: { $in: OPEN_PAYMENT_STATUSES }, dueDate: { $lt: now }, 'paymentVerification.status': { $in: ['awaiting_tenant', 'rejected'] } }, { $set: { status: 'overdue' } }),
    RentalInvoice.updateMany({ balanceAmount: { $lte: 0 }, status: { $ne: 'paid' } }, { $set: { status: 'paid' } }),
  ]);
  return { overdueInvoices: invoices.modifiedCount, overduePayments: payments.modifiedCount, settledInvoices: settled.modifiedCount };
}

export function daysBetweenCalendarDates(left, right) {
  const startLeft = new Date(left.getFullYear(), left.getMonth(), left.getDate());
  const startRight = new Date(right.getFullYear(), right.getMonth(), right.getDate());
  return Math.round((startLeft - startRight) / DAY);
}
