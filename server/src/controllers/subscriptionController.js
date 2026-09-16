import crypto from 'node:crypto';
import { Subscription, User, Property, PropertySpace, Payment, AuditLog, DriveFile, LandlordPlan } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ensureLandlordPlans, syncLandlordLifecycle, usageWithLimits } from '../services/landlordSubscription.js';
import { applyPaidPayment } from '../services/paymentLifecycle.js';
import { publicRazorpayConfig } from '../services/razorpay.js';
import { env } from '../config/env.js';
import { syncTenantEntitlements } from '../services/tenantEntitlements.js';

function isInternalPaymentProofUrl(value) {
  return /^\/api\/v1\/drive\/files\/[a-f0-9]{24}\/content$/i.test(String(value || '').trim());
}

function normalizeBillingCycle(value) {
  return value === 'yearly' ? 'yearly' : 'monthly';
}

function subscriptionRenewalState(subscription, now = new Date()) {
  const expiry = subscription?.expiresAt ? new Date(subscription.expiresAt) : null;
  const time = expiry?.getTime();
  if (!Number.isFinite(time)) return String(subscription?.status || 'pending');
  const daysRemaining = Math.ceil((time - now.getTime()) / 86_400_000);
  if (daysRemaining <= 0) return 'expired';
  if (daysRemaining <= 30) return 'expiring_soon';
  return String(subscription?.status || 'active');
}

function renewalSummary(subscription, now = new Date()) {
  const expiry = subscription?.expiresAt ? new Date(subscription.expiresAt) : null;
  const expiryMs = expiry?.getTime();
  const daysRemaining = Number.isFinite(expiryMs) ? Math.ceil((expiryMs - now.getTime()) / 86_400_000) : null;
  const state = subscriptionRenewalState(subscription, now);
  return {
    ...subscription,
    renewalState: state,
    daysRemaining,
    canRenew: ['active', 'expired', 'expiring_soon'].includes(state),
  };
}

async function assertPaymentProofOwner(userId, proofUrl) {
  const fileId = String(proofUrl || '').match(/^\/api\/v1\/drive\/files\/([a-f0-9]{24})\/content$/i)?.[1];
  const file = fileId ? await DriveFile.findOne({ _id: fileId, owner: userId, status: 'active' }).select('mimeType').lean() : null;
  if (!file || !String(file.mimeType || '').startsWith('image/')) throw new ApiError(422, 'Payment screenshot must be an active image uploaded by this account');
}

export const listPlans = asyncHandler(async (_req, res) => {
  await ensureLandlordPlans();
  const data = await LandlordPlan.find({ active: true }).sort({ rank: 1 }).lean();
  res.json({ success: true, data });
});

export const mySubscription = asyncHandler(async (req, res) => {
  await syncLandlordLifecycle(req.user._id);
  const [data, pending, latestRenewable] = await Promise.all([
    usageWithLimits(req.user._id),
    Subscription.findOne({ user: req.user._id, status: 'pending' }).sort('-createdAt').lean(),
    Subscription.findOne({ user: req.user._id, status: { $in: ['active', 'expired'] } }).sort({ expiresAt: -1, createdAt: -1 }).lean(),
  ]);
  // When access has expired, retain the most recent subscription in the
  // account summary. The tenant can then see the expiry state and renew it
  // directly rather than being dropped onto a generic plan-selection screen.
  const subscription = data.subscription || latestRenewable;
  res.json({ success: true, data: { ...data, subscription: subscription ? renewalSummary(subscription) : null, pending: pending ? renewalSummary(pending) : null } });
});

export const subscriptionHistory = asyncHandler(async (req, res) => {
  await syncLandlordLifecycle(req.user._id);
  const [subscriptions, payments] = await Promise.all([
    Subscription.find({ user: req.user._id }).sort({ createdAt: -1 }).lean(),
    Payment.find({ payer: req.user._id, type: 'landlord_subscription' }).sort({ createdAt: -1 }).lean(),
  ]);
  const paymentBySubscription = new Map();
  for (const payment of payments) {
    const subscriptionId = String(payment.gateway?.subscriptionId || '');
    if (!subscriptionId) continue;
    const rows = paymentBySubscription.get(subscriptionId) || [];
    rows.push(payment);
    paymentBySubscription.set(subscriptionId, rows);
  }
  const now = new Date();
  const data = subscriptions.map((subscription) => ({
    ...renewalSummary(subscription, now),
    payments: paymentBySubscription.get(String(subscription._id)) || [],
  }));
  res.json({ success: true, data });
});

export const checkout = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Only Tenant accounts can purchase a Landlord subscription');
  await ensureLandlordPlans();
  const planKey = String(req.body.plan || 'starter').trim().toLowerCase();
  const billingCycle = normalizeBillingCycle(req.body.billingCycle);
  const plan = await LandlordPlan.findOne({ key: planKey, active: true }).lean();
  if (!plan) throw new ApiError(422, 'Invalid or inactive subscription plan');
  const amount = Number(plan.prices?.[billingCycle] || 0);
  const now = new Date();
  const paymentMethod = ['upi', 'bank_transfer'].includes(req.body.method) ? req.body.method : 'offline';
  const transactionId = String(req.body.transactionId || '').trim();
  const proofUrl = String(req.body.proofUrl || '').trim();
  if (paymentMethod === 'upi') {
    const paymentConfig = await publicRazorpayConfig();
    if (!paymentConfig.upiId) throw new ApiError(503, 'Manual UPI payments are not configured by the administrator');
    if (!transactionId) throw new ApiError(422, 'UPI transaction ID is required');
    if (!isInternalPaymentProofUrl(proofUrl)) throw new ApiError(422, 'Payment screenshot is required for UPI payment');
    await assertPaymentProofOwner(req.user._id, proofUrl);
    if (await Payment.exists({ transactionId })) throw new ApiError(409, 'This UPI transaction ID has already been submitted');
  }

  await Subscription.updateMany({ user: req.user._id, status: 'pending' }, { $set: { status: 'cancelled', cancelledAt: now } });
  const subscription = await Subscription.create({
    user: req.user._id,
    plan: plan.key,
    billingCycle,
    amount,
    status: 'pending',
    limits: { ...plan.limits, ...plan.features },
    payment: { method: 'manual', gateway: 'manual-approval', metadata: { planSnapshot: plan } },
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  const payment = await Payment.create({
    invoiceNumber: `SUB-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
    payer: req.user._id,
    type: 'landlord_subscription',
    amount,
    paidAmount: 0,
    status: 'pending',
    dueDate: now,
    method: paymentMethod,
    transactionId: transactionId || undefined,
    proofUrl: proofUrl || undefined,
    paymentVerification: paymentMethod === 'upi'
      ? { status: 'submitted', submittedAt: now, submittedBy: req.user._id, submissionCount: 1 }
      : undefined,
    gateway: { provider: 'manual', subscriptionId: subscription._id },
    notes: `${plan.name} Landlord plan — awaiting verified payment`,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  if (env.PAYMENT_AUTO_APPROVE) {
    payment.status = 'paid'; payment.paidAmount = amount; payment.paidAt = now; payment.transactionId ||= `DEV-SUB-${Date.now()}`;
    await payment.save();
    await applyPaidPayment(payment, { userId: req.user._id, role: req.user.role, ip: req.ip, device: req.get('user-agent') });
  }
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'subscription:checkout-created', module: 'subscriptions', recordId: subscription._id, updatedValue: { plan: plan.key, billingCycle, amount, paymentId: payment._id }, ip: req.ip, device: req.get('user-agent') });
  res.status(201).json({ success: true, data: { subscription, payment }, message: env.PAYMENT_AUTO_APPROVE ? 'Landlord subscription activated' : 'Payment submitted and awaiting verification' });
});

export const renew = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Only Tenant accounts can renew a Landlord subscription');
  const subscription = await Subscription.findOne({ _id: req.params.id, user: req.user._id });
  if (!subscription) throw new ApiError(404, 'Subscription not found');
  if (!['active', 'expired'].includes(String(subscription.status || ''))) {
    throw new ApiError(409, 'Only active or expired subscriptions can be renewed');
  }

  await ensureLandlordPlans();
  // A renewal keeps the existing plan intact until the payment is verified.
  // This prevents a pending or rejected renewal from silently changing a
  // tenant's entitlement tier. Choosing another plan remains a new checkout.
  const planKey = String(subscription.plan || '').trim().toLowerCase();
  const plan = await LandlordPlan.findOne({ key: planKey, active: true }).lean();
  if (!plan) throw new ApiError(422, 'This subscription plan is no longer active; choose a current plan instead');
  const billingCycle = normalizeBillingCycle(subscription.billingCycle);
  const amount = Number(plan.prices?.[billingCycle] || 0);
  const paymentMethod = ['upi', 'bank_transfer'].includes(req.body.method) ? req.body.method : 'offline';
  const transactionId = String(req.body.transactionId || '').trim();
  const proofUrl = String(req.body.proofUrl || '').trim();
  if (paymentMethod === 'upi') {
    const paymentConfig = await publicRazorpayConfig();
    if (!paymentConfig.upiId) throw new ApiError(503, 'Manual UPI payments are not configured by the administrator');
    if (!transactionId) throw new ApiError(422, 'UPI transaction ID is required');
    if (!isInternalPaymentProofUrl(proofUrl)) throw new ApiError(422, 'Payment screenshot is required for UPI payment');
    await assertPaymentProofOwner(req.user._id, proofUrl);
    if (await Payment.exists({ transactionId })) throw new ApiError(409, 'This UPI transaction ID has already been submitted');
  }

  const existingPayment = await Payment.findOne({
    payer: req.user._id,
    type: 'landlord_subscription',
    status: 'pending',
    'gateway.subscriptionId': subscription._id,
    'gateway.action': 'renewal',
  }).sort({ createdAt: -1 });
  if (existingPayment) {
    res.status(200).json({ success: true, data: { subscription, payment: existingPayment }, message: 'A renewal payment is already awaiting completion' });
    return;
  }

  const now = new Date();
  const payment = await Payment.create({
    invoiceNumber: `SUB-RNW-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
    payer: req.user._id,
    type: 'landlord_subscription',
    amount,
    paidAmount: 0,
    status: 'pending',
    dueDate: now,
    method: paymentMethod,
    transactionId: transactionId || undefined,
    proofUrl: proofUrl || undefined,
    paymentVerification: paymentMethod === 'upi'
      ? { status: 'submitted', submittedAt: now, submittedBy: req.user._id, submissionCount: 1 }
      : undefined,
    gateway: { provider: 'manual', subscriptionId: subscription._id, action: 'renewal' },
    notes: `${plan.name} Landlord plan renewal — awaiting verified payment`,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  if (env.PAYMENT_AUTO_APPROVE) {
    payment.status = 'paid'; payment.paidAmount = amount; payment.paidAt = now; payment.transactionId ||= `DEV-RNW-${Date.now()}`;
    await payment.save();
    await applyPaidPayment(payment, { userId: req.user._id, role: req.user.role, ip: req.ip, device: req.get('user-agent') });
  }
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'subscription:renewal-created', module: 'subscriptions', recordId: subscription._id, updatedValue: { plan: plan.key, billingCycle, amount, paymentId: payment._id }, ip: req.ip, device: req.get('user-agent') });
  res.status(201).json({ success: true, data: { subscription, payment }, message: env.PAYMENT_AUTO_APPROVE ? 'Landlord subscription renewed' : 'Renewal payment submitted and awaiting verification' });
});

export const cancel = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Only Tenant accounts can cancel a Landlord subscription');
  const subscription = await Subscription.findOne({ _id: req.params.id, user: req.user._id, status: { $in: ['active', 'pending'] } });
  if (!subscription) throw new ApiError(404, 'Active or pending subscription not found');
  subscription.status = 'cancelled'; subscription.cancelledAt = new Date(); await subscription.save();
  if (req.user.landlordEnabled) {
    await syncTenantEntitlements(req.user._id);
    await Property.updateMany({ owner: req.user._id, requiresActiveSubscription: true }, { visibility: 'private', publicationStatus: 'draft' });
    await PropertySpace.updateMany({ owner: req.user._id }, { visibility: 'private', publicationStatus: 'draft' });
  }
  res.json({ success: true, data: subscription, message: 'Subscription cancelled. Existing data remains saved and public listings were paused.' });
});
