import test from 'node:test';
import assert from 'node:assert/strict';
import {
  User, Subscription, SurveyorSubscription, FacilityBooking, RentalInvoice, Notification, AuditLog,
} from '../server/src/models/index.js';
import { applyPaidPayment } from '../server/src/services/paymentLifecycle.js';

function patch(target, name, replacement, restorers) {
  const original = target[name];
  target[name] = replacement;
  restorers.push(() => { target[name] = original; });
}

test('payment lifecycle refuses pending and partially paid payments', async () => {
  await assert.rejects(
    applyPaidPayment({ status: 'pending', amount: 100, paidAmount: 0, gateway: {} }),
    /paid payment/,
  );
  await assert.rejects(
    applyPaidPayment({ status: 'paid', amount: 100, paidAmount: 50, gateway: {} }),
    /full payable amount/,
  );
});

test('landlord subscription activation is idempotent', async () => {
  const restorers = [];
  const calls = { notifications: 0, audits: 0, userUpdates: 0, subscriptionSaves: 0 };
  const subscription = {
    _id: 'sub-1', user: 'user-1', plan: 'professional', billingCycle: 'monthly', payment: {},
    async save() { calls.subscriptionSaves += 1; return this; },
  };
  patch(Subscription, 'findById', async () => subscription, restorers);
  patch(Subscription, 'updateMany', async () => ({ acknowledged: true }), restorers);
  patch(User, 'findByIdAndUpdate', async () => { calls.userUpdates += 1; }, restorers);
  patch(Notification, 'findOneAndUpdate', async () => { calls.notifications += 1; }, restorers);
  patch(AuditLog, 'findOneAndUpdate', async () => { calls.audits += 1; }, restorers);

  const payment = {
    _id: 'pay-1', payer: 'user-1', status: 'paid', type: 'landlord_subscription', amount: 699, paidAmount: 50,
    paidAt: new Date('2026-06-26T00:00:00Z'), method: 'bank_transfer', transactionId: 'TX-1',
    paymentVerification: { status: 'approved' },
    gateway: { subscriptionId: 'sub-1', provider: 'manual_admin' },
    async save() { return this; },
  };

  try {
    await applyPaidPayment(payment, { userId: 'admin-1', role: 'admin' });
    await applyPaidPayment(payment, { userId: 'admin-1', role: 'admin' });
    assert.equal(payment.paidAmount, 699);
    assert.equal(subscription.status, 'active');
    assert.equal(subscription.paymentHistory.length, 1);
    assert.equal(subscription.renewalHistory.length, 1);
    assert.equal(subscription.paymentHistory[0].transactionId, 'TX-1');
    assert.equal(calls.subscriptionSaves, 1);
    assert.equal(calls.userUpdates, 1);
    assert.equal(calls.notifications, 1);
    assert.equal(calls.audits, 1);
    assert.ok(payment.gateway.lifecycleAppliedAt);
  } finally {
    restorers.reverse().forEach((restore) => restore());
  }
});

test('surveyor activation does not duplicate payment history on retry', async () => {
  const restorers = [];
  const subscription = {
    _id: 'ssub-1', user: 'user-2', billingCycle: 'monthly', paymentHistory: [],
    async save() { return this; },
  };
  patch(SurveyorSubscription, 'findById', async () => subscription, restorers);
  patch(SurveyorSubscription, 'updateMany', async () => ({ acknowledged: true }), restorers);
  patch(User, 'findByIdAndUpdate', async () => ({}), restorers);
  patch(Notification, 'findOneAndUpdate', async () => ({}), restorers);
  patch(AuditLog, 'findOneAndUpdate', async () => ({}), restorers);

  const payment = {
    _id: 'pay-2', payer: 'user-2', status: 'paid', type: 'surveyor_subscription', amount: 1499, paidAmount: 1499,
    paidAt: new Date('2026-06-26T00:00:00Z'), method: 'gateway', transactionId: 'TX-2',
    gateway: { subscriptionId: 'ssub-1', provider: 'verified_gateway' },
    async save() { return this; },
  };

  try {
    await applyPaidPayment(payment, { userId: 'system', role: 'system' });
    delete payment.gateway.lifecycleAppliedAt;
    await applyPaidPayment(payment, { userId: 'system', role: 'system' });
    assert.equal(subscription.paymentHistory.length, 1);
    assert.equal(subscription.paymentHistory[0].transactionId, 'TX-2');
  } finally {
    restorers.reverse().forEach((restore) => restore());
  }
});


test('facility booking payment marks the linked booking paid exactly once', async () => {
  const restorers = [];
  const calls = { saves: 0, notifications: 0, audits: 0 };
  const booking = {
    _id: 'booking-1', owner: 'owner-1', requester: 'tenant-1', paymentStatus: 'pending',
    async save() { calls.saves += 1; return this; },
  };
  patch(FacilityBooking, 'findById', async () => booking, restorers);
  patch(Notification, 'findOneAndUpdate', async () => { calls.notifications += 1; }, restorers);
  patch(AuditLog, 'findOneAndUpdate', async () => { calls.audits += 1; }, restorers);
  const payment = {
    _id: 'pay-facility-1', payer: 'tenant-1', payee: 'owner-1', status: 'paid', type: 'facility_booking',
    facilityBooking: 'booking-1', amount: 1200, paidAmount: 1200, paidAt: new Date('2026-06-26T00:00:00Z'),
    invoiceNumber: 'FAC-2026-0001', gateway: {}, async save() { return this; },
  };
  try {
    await applyPaidPayment(payment, { userId: 'admin-1', role: 'admin' });
    await applyPaidPayment(payment, { userId: 'admin-1', role: 'admin' });
    assert.equal(booking.paymentStatus, 'paid');
    assert.equal(booking.payment, payment._id);
    assert.equal(calls.saves, 1);
    assert.equal(calls.notifications, 2);
    assert.equal(calls.audits, 1);
  } finally {
    restorers.reverse().forEach((restore) => restore());
  }
});

test('accepted rent payment settles its linked rental invoice exactly once', async () => {
  const restorers = [];
  const calls = { saves: 0, notifications: 0, audits: 0 };
  const invoice = {
    _id: 'invoice-1', tenant: 'tenant-1', landlord: 'landlord-1', totalAmount: 18000, paidAmount: 0, balanceAmount: 18000,
    dueDate: new Date('2026-06-01T09:00:00Z'), status: 'pending', payments: [],
    async save() { calls.saves += 1; return this; },
  };
  patch(RentalInvoice, 'findById', async () => invoice, restorers);
  patch(Notification, 'findOneAndUpdate', async () => { calls.notifications += 1; }, restorers);
  patch(AuditLog, 'findOneAndUpdate', async () => { calls.audits += 1; }, restorers);
  const payment = {
    _id: 'rent-payment-1', payer: 'tenant-1', payee: 'landlord-1', rentalInvoice: 'invoice-1', type: 'rent', status: 'paid',
    amount: 18000, paidAmount: 18000, paidAt: new Date('2026-06-01T09:30:00Z'), method: 'upi', transactionId: 'UPI-123',
    paymentVerification: { submittedAt: new Date('2026-06-01T09:15:00Z'), status: 'approved' }, gateway: {}, async save() { return this; },
  };
  try {
    await applyPaidPayment(payment, { userId: 'landlord-1', role: 'landlord' });
    await applyPaidPayment(payment, { userId: 'landlord-1', role: 'landlord' });
    assert.equal(invoice.status, 'paid');
    assert.equal(invoice.paidAmount, 18000);
    assert.equal(invoice.balanceAmount, 0);
    assert.equal(invoice.payments.length, 1);
    assert.equal(invoice.payments[0].payment, payment._id);
    assert.equal(calls.saves, 1);
    assert.equal(calls.notifications, 2);
    assert.equal(calls.audits, 1);
  } finally {
    restorers.reverse().forEach((restore) => restore());
  }
});
