import { AuditLog, DriveFile, Payment, Subscription, SurveyorSubscription } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { applyPaidPayment } from '../services/paymentLifecycle.js';
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  publicRazorpayConfig,
  razorpayWebhookEventKey,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
} from '../services/razorpay.js';
import { sendStoredFile } from '../utils/httpFile.js';
import { syncTenantEntitlements } from '../services/tenantEntitlements.js';

async function resolveSubscriptionOrderPayment(subscription, type) {
  const query = { payer: subscription.user, type, status: { $in: ['pending', 'paid', 'partial'] } };
  let payment = await Payment.findOne({ ...query, 'gateway.subscriptionId': subscription._id }).sort('-createdAt');
  const metadataPaymentId = subscription.payment?.metadata?.paymentId;
  if (!payment && metadataPaymentId) payment = await Payment.findOne({ ...query, _id: metadataPaymentId });
  if (!payment) {
    const audit = await AuditLog.findOne({ action: 'subscription:checkout-created', recordId: subscription._id }).sort('-createdAt').lean();
    const auditPaymentId = audit?.updatedValue?.paymentId;
    if (auditPaymentId) payment = await Payment.findOne({ ...query, _id: auditPaymentId });
  }
  if (payment) {
    if (!payment.gateway?.subscriptionId) {
      payment.gateway = { ...(payment.gateway || {}), provider: payment.gateway?.provider || 'manual', subscriptionId: subscription._id, reconciledAt: new Date() };
      await payment.save({ validateModifiedOnly: true });
    }
    return payment;
  }
  const amount = Number(subscription.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new ApiError(422, 'Subscription payable amount is invalid');
  const method = ['upi', 'bank_transfer', 'offline'].includes(subscription.payment?.method) ? subscription.payment.method : 'offline';
  return Payment.create({
    invoiceNumber: `SUB-RECOVERY-${subscription._id}-${Date.now()}`,
    payer: subscription.user, type, amount, paidAmount: 0, status: 'pending', dueDate: subscription.createdAt || new Date(), method,
    transactionId: subscription.payment?.transactionId || undefined, proofUrl: subscription.payment?.proofUrl || undefined,
    gateway: { provider: 'manual', subscriptionId: subscription._id, recovery: true },
    notes: 'Recovered pending payment link for legacy subscription order; requires administrator approval',
    createdBy: subscription.createdBy || subscription.user, updatedBy: subscription.updatedBy || subscription.user,
  });
}

function assertCapturedSubscriptionPayment(localPayment, remotePayment, orderId, paymentId) {
  const expectedAmount = Math.round(Number(localPayment.amount || 0) * 100);
  const remoteAmount = Number(remotePayment?.amount);
  if (!remotePayment || String(remotePayment.id || '') !== String(paymentId || '')) throw new ApiError(409, 'Razorpay payment identity mismatch');
  if (String(remotePayment.order_id || '') !== String(orderId || '')) throw new ApiError(409, 'Razorpay order does not match the subscription payment');
  if (remotePayment.status !== 'captured' && remotePayment.captured !== true) throw new ApiError(409, 'Razorpay payment is not captured yet');
  if (!Number.isFinite(remoteAmount) || remoteAmount !== expectedAmount) throw new ApiError(409, 'Razorpay payment amount does not match the subscription order');
  if (String(remotePayment.currency || 'INR').toUpperCase() !== 'INR') throw new ApiError(409, 'Unexpected Razorpay payment currency');
}

async function applyVerifiedRazorpayPayment(payment, { orderId, paymentId, source, eventKey, req }) {
  const remotePayment = await fetchRazorpayPayment(paymentId);
  assertCapturedSubscriptionPayment(payment, remotePayment, orderId, paymentId);
  const now = new Date();
  const previousEvents = Array.isArray(payment.gateway?.webhookEventIds) ? payment.gateway.webhookEventIds : [];
  const webhookEventIds = eventKey ? [...new Set([...previousEvents, eventKey])].slice(-40) : previousEvents;
  payment.status = 'paid';
  payment.paidAmount = payment.amount;
  payment.paidAt = payment.paidAt || now;
  payment.method = 'gateway';
  payment.transactionId = String(paymentId);
  payment.gateway = {
    ...(payment.gateway || {}),
    provider: 'razorpay',
    paymentId: String(paymentId),
    orderId: String(orderId),
    capturedAt: remotePayment.captured_at ? new Date(Number(remotePayment.captured_at) * 1000) : (payment.gateway?.capturedAt || now),
    remoteVerifiedAt: now,
    ...(source === 'checkout' ? { signatureVerifiedAt: now } : {}),
    ...(source === 'webhook' ? {
      webhookVerifiedAt: now,
      webhookLastReceivedAt: now,
      webhookLastEvent: req?.bodyEvent || 'payment.captured',
      webhookEventIds,
    } : {}),
  };
  await payment.save({ validateModifiedOnly: true });
  await applyPaidPayment(payment, {
    userId: source === 'checkout' ? req?.user?._id : payment.payer,
    role: source === 'checkout' ? req?.user?.role : 'system',
    ip: req?.ip,
    device: source === 'checkout' ? req?.get?.('user-agent') : 'razorpay-webhook',
  });
  return payment;
}

export const paymentConfiguration = asyncHandler(async (_req, res) => res.json({ success: true, data: await publicRazorpayConfig() }));

async function assertApprovedUpiProof(payment) {
  const fileId = String(payment.proofUrl || '').match(/^\/api\/v1\/drive\/files\/([a-f0-9]{24})\/content$/i)?.[1];
  const file = fileId
    ? await DriveFile.findOne({ _id: fileId, owner: payment.payer, status: 'active' }).select('mimeType').lean()
    : null;
  if (!file || !String(file.mimeType || '').startsWith('image/')) {
    throw new ApiError(409, 'UPI payment screenshot must be an active image owned by the payer');
  }
}

export const verifyRazorpaySubscriptionPayment = asyncHandler(async (req, res) => {
  const { orderId, paymentId, signature } = req.body || {};
  if (!orderId || !paymentId || !signature) throw new ApiError(422, 'Razorpay payment details are incomplete');
  const payment = await Payment.findOne({
    payer: req.user._id,
    type: { $in: ['landlord_subscription', 'surveyor_subscription'] },
    status: { $in: ['pending', 'paid'] },
    'gateway.orderId': String(orderId),
  });
  if (!payment) throw new ApiError(404, 'Subscription payment order not found');
  if (payment.status === 'paid' && payment.gateway?.lifecycleAppliedAt) {
    return res.json({ success: true, data: payment, message: 'Payment already verified' });
  }
  if (!await verifyRazorpaySignature(orderId, paymentId, signature)) throw new ApiError(422, 'Razorpay signature verification failed');
  await applyVerifiedRazorpayPayment(payment, { orderId, paymentId, source: 'checkout', req });
  res.json({ success: true, data: payment, message: 'Payment verified, captured and subscription activated' });
});

export const razorpaySubscriptionWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) throw new ApiError(400, 'Razorpay webhook requires the raw request body');
  const signature = String(req.get('x-razorpay-signature') || '').trim();
  if (!signature) throw new ApiError(401, 'Missing Razorpay webhook signature');
  if (!await verifyRazorpayWebhookSignature(rawBody, signature)) throw new ApiError(401, 'Invalid Razorpay webhook signature');

  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); } catch { throw new ApiError(400, 'Invalid Razorpay webhook payload'); }
  const eventName = String(event?.event || '').trim();
  const eventKey = razorpayWebhookEventKey(rawBody, signature, req.get('x-razorpay-event-id'));
  const paymentEntity = event?.payload?.payment?.entity || null;
  const orderEntity = event?.payload?.order?.entity || null;

  if (!['payment.captured', 'order.paid', 'payment.failed'].includes(eventName)) {
    return res.json({ success: true, ignored: true, event: eventName || 'unknown' });
  }

  const orderId = String(paymentEntity?.order_id || orderEntity?.id || '').trim();
  const paymentId = String(paymentEntity?.id || '').trim();
  if (!orderId) return res.json({ success: true, ignored: true, event: eventName, reason: 'No order id in event' });

  const payment = await Payment.findOne({
    type: { $in: ['landlord_subscription', 'surveyor_subscription'] },
    'gateway.orderId': orderId,
  });
  if (!payment) return res.json({ success: true, ignored: true, event: eventName, reason: 'Order is not a SecureAsset subscription payment' });

  const previousEvents = Array.isArray(payment.gateway?.webhookEventIds) ? payment.gateway.webhookEventIds : [];
  if (previousEvents.includes(eventKey)) {
    return res.json({ success: true, duplicate: true, event: eventName });
  }

  if (eventName === 'payment.failed') {
    payment.gateway = {
      ...(payment.gateway || {}),
      webhookEventIds: [...new Set([...previousEvents, eventKey])].slice(-40),
      webhookLastReceivedAt: new Date(),
      webhookLastEvent: eventName,
      lastFailure: {
        paymentId: paymentId || undefined,
        code: paymentEntity?.error_code,
        description: paymentEntity?.error_description,
        reason: paymentEntity?.error_reason,
        at: new Date(),
      },
    };
    await payment.save({ validateModifiedOnly: true });
    return res.json({ success: true, recorded: true, event: eventName });
  }

  if (!paymentId) return res.json({ success: true, ignored: true, event: eventName, reason: 'No payment id in event' });

  if (payment.status === 'paid' && payment.transactionId === paymentId && payment.gateway?.lifecycleAppliedAt) {
    payment.gateway = {
      ...(payment.gateway || {}),
      webhookEventIds: [...new Set([...previousEvents, eventKey])].slice(-40),
      webhookLastReceivedAt: new Date(),
      webhookLastEvent: eventName,
      webhookVerifiedAt: new Date(),
    };
    await payment.save({ validateModifiedOnly: true });
    return res.json({ success: true, duplicate: true, event: eventName, message: 'Subscription payment was already applied' });
  }

  req.bodyEvent = eventName;
  await applyVerifiedRazorpayPayment(payment, { orderId, paymentId, source: 'webhook', eventKey, req });
  await AuditLog.findOneAndUpdate(
    { action: 'subscription:razorpay-webhook-applied', module: 'subscriptions', recordId: payment._id, 'updatedValue.eventKey': eventKey },
    { $setOnInsert: {
      user: payment.payer,
      role: 'system',
      action: 'subscription:razorpay-webhook-applied',
      module: 'subscriptions',
      recordId: payment._id,
      updatedValue: { event: eventName, eventKey, orderId, paymentId, amount: payment.amount },
      ip: req.ip,
      device: 'razorpay-webhook',
    } },
    { upsert: true, new: true },
  );
  res.json({ success: true, applied: true, event: eventName });
});

export const createRazorpaySubscriptionOrder = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.body.paymentId, payer: req.user._id, type: { $in: ['landlord_subscription', 'surveyor_subscription'] }, status: 'pending' });
  if (!payment) throw new ApiError(404, 'Pending subscription payment not found');
  const config = await publicRazorpayConfig();
  if (payment.gateway?.provider === 'razorpay' && payment.gateway.orderId) return res.json({ success: true, data: { order: payment.gateway.orderId, amount: payment.amount, currency: 'INR', keyId: config.keyId } });
  const order = await createRazorpayOrder({ amount: payment.amount, receipt: payment.invoiceNumber, notes: { paymentId: String(payment._id), type: payment.type } });
  payment.method = 'gateway'; payment.gateway = { ...(payment.gateway || {}), provider: 'razorpay', orderId: order.id }; await payment.save();
  res.status(201).json({ success: true, data: { order: order.id, amount: payment.amount, currency: order.currency, keyId: config.keyId } });
});

export const listPendingSubscriptionPayments = asyncHandler(async (req, res) => {
  const status = String(req.query.status || 'pending');
  const query = { type: { $in: ['landlord_subscription', 'surveyor_subscription'] }, ...(status === 'all' ? {} : { status }) };
  res.json({ success: true, data: await Payment.find(query).populate('payer', 'name email phone').sort('-createdAt').limit(200).lean() });
});

export const streamSubscriptionPaymentProof = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, type: { $in: ['landlord_subscription', 'surveyor_subscription'] } }).lean();
  if (!payment) throw new ApiError(404, 'Subscription payment not found');
  const match = String(payment.proofUrl || '').match(/^\/api\/v1\/drive\/files\/([a-f0-9]{24})\/content$/i);
  if (!match) throw new ApiError(404, 'Payment screenshot is not available');
  const file = await DriveFile.findOne({ _id: match[1], owner: payment.payer, status: 'active' }).select('+storageKey');
  if (!file) throw new ApiError(404, 'Payment screenshot is not available');
  await sendStoredFile(req, res, file, { download: req.query.download === 'true' });
});

async function approveManualPayment(payment, req) {
  if (!['upi', 'offline', 'bank_transfer'].includes(payment.method)) throw new ApiError(409, 'Only manual subscription payments can be approved here');
  if (payment.method === 'upi') {
    if (!/^\/api\/v1\/drive\/files\/[a-f0-9]{24}\/content$/i.test(String(payment.proofUrl || '').trim())) throw new ApiError(409, 'UPI payment screenshot is required before approval');
    if (!String(payment.transactionId || '').trim()) throw new ApiError(409, 'UPI transaction ID is required before approval');
    await assertApprovedUpiProof(payment);
  }
  const payableAmount = Number(payment.amount);
  if (!Number.isFinite(payableAmount) || payableAmount < 0) throw new ApiError(422, 'Subscription payment amount is invalid');
  const now = new Date();
  // Admin acceptance is the authorization boundary. Always normalize the
  // payment to the complete payable amount, including legacy records that
  // were incorrectly left as `paid` with a partial or missing paidAmount.
  payment.status = 'paid';
  payment.paidAmount = payableAmount;
  payment.paidAt = payment.paidAt || now;
  payment.paymentVerification = { ...(payment.paymentVerification || {}), status: 'approved', approvedAt: now, approvedBy: req.user._id }; payment.updatedBy = req.user._id; payment.gateway = { ...(payment.gateway || {}), provider: 'manual_admin_approval', approvedBy: req.user._id };
  await payment.save();
  if (!payment.gateway?.lifecycleAppliedAt) await applyPaidPayment(payment, { userId: req.user._id, role: req.user.role, ip: req.ip, device: req.get('user-agent') });
  await AuditLog.findOneAndUpdate(
    { action: 'subscription:manual-payment-approved', module: 'subscriptions', recordId: payment._id },
    { $setOnInsert: { user: req.user._id, role: req.user.role, action: 'subscription:manual-payment-approved', module: 'subscriptions', recordId: payment._id, updatedValue: { paymentId: payment._id, payer: payment.payer, type: payment.type, amount: payment.amount }, ip: req.ip, device: req.get('user-agent') } },
    { upsert: true, new: true },
  );
  return payment;
}

export const approveManualSubscriptionPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, type: { $in: ['landlord_subscription', 'surveyor_subscription'] }, status: { $in: ['pending', 'paid', 'partial'] } });
  if (!payment) throw new ApiError(404, 'Pending subscription payment not found');
  await approveManualPayment(payment, req);
  res.json({ success: true, data: payment, message: 'Manual payment approved and subscription activated' });
});

export const approveManualSubscriptionOrder = asyncHandler(async (req, res) => {
  const landlord = await Subscription.findOne({ _id: req.params.id, status: 'pending' });
  const surveyor = landlord ? null : await SurveyorSubscription.findOne({ _id: req.params.id, status: 'payment_pending' });
  const subscription = landlord || surveyor;
  if (!subscription) throw new ApiError(409, 'This subscription order is no longer awaiting activation');
  const type = landlord ? 'landlord_subscription' : 'surveyor_subscription';
  const payment = await resolveSubscriptionOrderPayment(subscription, type);

  await approveManualPayment(payment, req);
  res.json({ success: true, data: { subscription, payment }, message: 'Tenant subscription accepted and activated' });
});

export const rejectManualSubscriptionPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, type: { $in: ['landlord_subscription', 'surveyor_subscription'] }, status: 'pending' });
  if (!payment) throw new ApiError(404, 'Pending subscription payment not found');
  const reason = String(req.body.reason || 'Payment proof was not accepted').slice(0, 500);
  payment.status = 'failed'; payment.notes = `${payment.notes || ''}\nRejected by admin: ${reason}`; payment.paymentVerification = { ...(payment.paymentVerification || {}), status: 'rejected', rejectedAt: new Date(), rejectedBy: req.user._id, rejectionReason: reason }; payment.updatedBy = req.user._id; await payment.save();
  const Model = payment.type === 'landlord_subscription' ? Subscription : SurveyorSubscription;
  const linked = await Model.findOne({ _id: payment.gateway?.subscriptionId, user: payment.payer, status: { $in: ['pending', 'payment_pending'] } });
  if (linked) { linked.status = 'cancelled'; linked.cancelledAt = new Date(); linked.updatedBy = req.user._id; await linked.save(); await syncTenantEntitlements(linked.user); }
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'subscription:manual-payment-rejected', module: 'subscriptions', recordId: payment._id, updatedValue: { paymentId: payment._id, payer: payment.payer, type: payment.type, reason }, ip: req.ip, device: req.get('user-agent') });
  res.json({ success: true, data: payment, message: 'Manual subscription payment rejected' });
});

export const rejectManualSubscriptionOrder = asyncHandler(async (req, res) => {
  const landlord = await Subscription.findOne({ _id: req.params.id, status: 'pending' });
  const surveyor = landlord ? null : await SurveyorSubscription.findOne({ _id: req.params.id, status: 'payment_pending' });
  const subscription = landlord || surveyor;
  const type = landlord ? 'landlord_subscription' : 'surveyor_subscription';
  const payment = subscription ? await resolveSubscriptionOrderPayment(subscription, type) : null;
  if (!subscription) throw new ApiError(409, 'This subscription order is no longer awaiting review');
  const reason = String(req.body?.reason || 'Subscription request was not approved').slice(0, 500); const now = new Date();
  payment.status = 'failed'; payment.notes = `${payment.notes || ''}\nRejected by admin: ${reason}`; payment.paymentVerification = { ...(payment.paymentVerification || {}), status: 'rejected', rejectedAt: now, rejectedBy: req.user._id, rejectionReason: reason }; payment.updatedBy = req.user._id; await payment.save();
  subscription.status = 'cancelled'; subscription.cancelledAt = now; subscription.updatedBy = req.user._id; await subscription.save(); await syncTenantEntitlements(subscription.user);
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'subscription:manual-order-rejected', module: 'subscriptions', recordId: subscription._id, updatedValue: { subscriptionId: subscription._id, paymentId: payment._id, reason }, ip: req.ip, device: req.get('user-agent') });
  res.json({ success: true, data: { subscription, payment }, message: 'Subscription rejected; payment marked failed and features remain disabled' });
});
