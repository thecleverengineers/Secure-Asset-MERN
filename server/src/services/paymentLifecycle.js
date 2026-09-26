import {
  User,
  Property,
  PropertySpace,
  Payment,
  Subscription,
  SurveyorSubscription,
  SurveyProject,
  FacilityBooking,
  RentalInvoice,
  RentCycle,
  Notification,
  AuditLog,
} from '../models/index.js';
import { notifyPaymentCompleted, notifyRentReceipt } from './whatsappNotifications.js';
import { syncTenantEntitlements } from './tenantEntitlements.js';

function addCycle(date, cycle) {
  const result = new Date(date);
  if (cycle === 'yearly') result.setUTCFullYear(result.getUTCFullYear() + 1);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}

function isApprovedManualSubscription(payment) {
  return payment.paymentVerification?.status === 'approved'
    && ['landlord_subscription', 'surveyor_subscription'].includes(payment.type)
    && ['upi', 'offline', 'bank_transfer'].includes(payment.method);
}

function normalizeApprovedManualSubscription(payment) {
  if (!isApprovedManualSubscription(payment)) return;
  const payableAmount = Number(payment.amount);
  if (!Number.isFinite(payableAmount) || payableAmount < 0) throw new Error('Subscription payment amount is invalid');
  // An administrator-approved manual subscription is a full authorization,
  // so lifecycle execution must never continue with a stale partial amount.
  payment.status = 'paid';
  payment.paidAmount = payableAmount;
  payment.paidAt ||= new Date();
}

export async function applyPaidPayment(paymentOrId, actor = {}) {
  const payment = typeof paymentOrId === 'string' ? await Payment.findById(paymentOrId) : paymentOrId;
  if (!payment) throw new Error('Payment not found');
  normalizeApprovedManualSubscription(payment);
  if (payment.status !== 'paid') throw new Error('Payment lifecycle can only be applied to a paid payment');
  const payableAmount = Number(payment.amount);
  const paidAmount = Number(payment.paidAmount);
  if (!Number.isFinite(payableAmount) || payableAmount < 0) throw new Error('Payment amount is invalid');
  if (!Number.isFinite(paidAmount) || paidAmount < payableAmount) throw new Error('Payment lifecycle requires the full payable amount');
  if (payment.gateway?.lifecycleAppliedAt) return payment;

  const now = payment.paidAt || new Date();
  if (payment.type === 'landlord_subscription') {
    const subscriptionId = payment.gateway?.subscriptionId;
    const subscription = subscriptionId ? await Subscription.findById(subscriptionId) : null;
    if (!subscription) throw new Error('Landlord subscription record is missing for this payment');
    const renewalBase = payment.gateway?.action === 'renewal' && subscription.expiresAt && new Date(subscription.expiresAt) > now
      ? new Date(subscription.expiresAt)
      : now;
    const expiresAt = addCycle(renewalBase, subscription.billingCycle);
    await Subscription.updateMany({ user: subscription.user, _id: { $ne: subscription._id }, status: 'active' }, { $set: { status: 'cancelled', cancelledAt: now } });
    subscription.status = 'active';
    subscription.startsAt ||= now;
    subscription.expiresAt = expiresAt;
    subscription.nextRenewalAt = expiresAt;
    subscription.payment = {
      ...(subscription.payment || {}),
      method: payment.method,
      transactionId: payment.transactionId,
      gateway: payment.gateway?.provider || payment.method,
      paidAt: now,
      metadata: { ...(subscription.payment?.metadata || {}), paymentId: payment._id },
    };
    subscription.paymentHistory ||= [];
    subscription.renewalHistory ||= [];
    const alreadyRecorded = subscription.paymentHistory.some((entry) =>
      (payment.transactionId && entry.transactionId === payment.transactionId) || String(entry.paymentId || '') === String(payment._id),
    );
    if (!alreadyRecorded) subscription.paymentHistory.push({ status: 'paid', amount: payment.amount, currency: subscription.currency || 'INR', transactionId: payment.transactionId, gateway: payment.gateway?.provider || payment.method, paidAt: now, paymentId: payment._id });
    const renewalRecorded = subscription.renewalHistory.some((entry) => String(entry.paymentId || '') === String(payment._id));
    if (!renewalRecorded) subscription.renewalHistory.push({ planKey: subscription.plan, startsAt: renewalBase, expiresAt, amount: payment.amount, currency: subscription.currency || 'INR', renewedAt: now, paymentId: payment._id });
    subscription.updatedBy = actor.userId || payment.payer;
    await subscription.save();
    await syncTenantEntitlements(subscription.user);
    await Notification.findOneAndUpdate(
      { user: subscription.user, 'metadata.paymentId': payment._id, 'metadata.event': 'landlord_subscription_activated' },
      { $setOnInsert: { user: subscription.user, title: 'Landlord subscription activated', message: `Your ${subscription.plan} plan is active until ${expiresAt.toLocaleDateString('en-IN')}.`, category: 'payment', actionUrl: '/app/subscription', metadata: { paymentId: payment._id, event: 'landlord_subscription_activated' } } },
      { upsert: true, new: true },
    );
  }

  if (payment.type === 'surveyor_subscription') {
    const subscriptionId = payment.gateway?.subscriptionId;
    const subscription = subscriptionId ? await SurveyorSubscription.findById(subscriptionId) : null;
    if (!subscription) throw new Error('Surveyor subscription record is missing for this payment');
    const renewalBase = payment.gateway?.action === 'renewal' && subscription.expiresAt && new Date(subscription.expiresAt) > now
      ? new Date(subscription.expiresAt)
      : now;
    const expiresAt = addCycle(renewalBase, subscription.billingCycle);
    await SurveyorSubscription.updateMany({ user: subscription.user, _id: { $ne: subscription._id }, status: { $in: ['trial', 'active', 'expiring_soon', 'grace_period', 'payment_pending'] } }, { $set: { status: 'cancelled', cancelledAt: now } });
    subscription.status = 'active';
    subscription.startsAt ||= now;
    subscription.expiresAt = expiresAt;
    subscription.nextRenewalAt = expiresAt;
    subscription.paymentHistory ||= [];
    subscription.renewalHistory ||= [];
    const alreadyRecorded = subscription.paymentHistory.some((entry) =>
      (payment.transactionId && entry.transactionId === payment.transactionId) || String(entry.paymentId || '') === String(payment._id),
    );
    if (!alreadyRecorded) subscription.paymentHistory.push({ status: 'paid', amount: payment.amount, transactionId: payment.transactionId, gateway: payment.gateway?.provider || payment.method, paidAt: now, paymentId: payment._id });
    const renewalRecorded = subscription.renewalHistory.some((entry) => String(entry.paymentId || '') === String(payment._id));
    if (!renewalRecorded) subscription.renewalHistory.push({ planKey: subscription.planKey, startsAt: renewalBase, expiresAt, amount: payment.amount, renewedAt: now, paymentId: payment._id });
    subscription.updatedBy = actor.userId || payment.payer;
    await subscription.save();
    await syncTenantEntitlements(subscription.user);
    await Notification.findOneAndUpdate(
      { user: subscription.user, 'metadata.paymentId': payment._id, 'metadata.event': 'surveyor_subscription_activated' },
      { $setOnInsert: { user: subscription.user, title: 'Surveyor features activated', message: `Your Surveyor subscription is active until ${expiresAt.toLocaleDateString('en-IN')}.`, category: 'payment', actionUrl: '/app/surveyor-subscription', metadata: { paymentId: payment._id, event: 'surveyor_subscription_activated' } } },
      { upsert: true, new: true },
    );
  }

  if (['survey_advance', 'survey_milestone', 'survey_final'].includes(payment.type) && payment.surveyProject) {
    const project = await SurveyProject.findById(payment.surveyProject);
    if (project) {
      project.paymentSummary ||= {};
      const paidInvoices = await Payment.aggregate([
        { $match: { surveyProject: project._id, type: { $in: ['survey_advance', 'survey_milestone', 'survey_final'] }, status: { $in: ['paid', 'partial'] } } },
        { $group: { _id: null, total: { $sum: '$paidAmount' } } },
      ]);
      project.paymentSummary.paid = Number(paidInvoices[0]?.total || 0);
      project.paymentSummary.outstanding = Math.max(0, Number(project.paymentSummary.total || 0) - project.paymentSummary.paid);
      if (project.status === 'awaiting_advance_payment' && payment.type === 'survey_advance') project.status = 'new';
      if (payment.type === 'survey_milestone' && payment.gateway?.milestoneId && payment.status === 'paid') {
        const milestone = project.milestones?.id(payment.gateway.milestoneId);
        if (milestone && milestone.status !== 'paid') { milestone.status = 'paid'; milestone.paidAt = now; }
      }
      // Paying a survey balance authorizes report upload; it never verifies a
      // property by itself. Verification is intentionally delayed until the
      // assigned Surveyor uploads the final report through the workflow.
      if (project.workflowStage === 'approved' && project.paymentSummary.outstanding <= 0 && !['completed', 'cancelled'].includes(project.status)) {
        project.status = 'report_upload_requested';
        project.reportUploadRequestedAt ||= now;
      }
      await project.save();
    }
    if (payment.payee) await Notification.findOneAndUpdate(
      { user: payment.payee, 'metadata.paymentId': payment._id, 'metadata.event': 'survey_payment_received' },
      { $setOnInsert: { user: payment.payee, title: 'Survey payment received', message: `${payment.invoiceNumber || 'Survey invoice'} has been paid.`, category: 'payment', actionUrl: `/app/survey-projects/${payment.surveyProject}`, metadata: { paymentId: payment._id, projectId: payment.surveyProject, event: 'survey_payment_received' } } },
      { upsert: true, new: true },
    );
  }

  if (payment.type === 'rent' && payment.rentalInvoice) {
    const invoice = await RentalInvoice.findById(payment.rentalInvoice);
    if (!invoice) throw new Error('Rental invoice record is missing for this payment');
    const total = Math.max(0, Number(invoice.totalAmount || 0));
    const paidBefore = Math.max(0, Number(invoice.paidAmount || 0));
    const acceptedAmount = Math.max(0, Number(payment.paidAmount || payment.amount || 0));
    invoice.paidAmount = Math.min(total, paidBefore + acceptedAmount);
    invoice.balanceAmount = Math.max(0, total - Number(invoice.paidAmount || 0));
    invoice.status = invoice.balanceAmount <= 0 ? 'paid' : invoice.paidAmount > 0 ? 'partially_paid' : (new Date(invoice.dueDate) < now ? 'overdue' : 'pending');
    invoice.payments ||= [];
    const entryIndex = invoice.payments.findIndex((entry) => String(entry?.payment || '') === String(payment._id));
    const entry = {
      payment: payment._id,
      amount: acceptedAmount,
      method: payment.method,
      transactionId: payment.transactionId,
      submittedAt: payment.paymentVerification?.submittedAt,
      acceptedAt: now,
      paidAt: now,
      status: 'approved',
    };
    if (entryIndex >= 0) invoice.payments[entryIndex].set ? invoice.payments[entryIndex].set(entry) : Object.assign(invoice.payments[entryIndex], entry);
    else invoice.payments.push(entry);
    invoice.updatedBy = actor.userId || payment.payee;
    await invoice.save({ validateModifiedOnly: true });
    if (invoice.rentCycle) {
      await RentCycle.updateOne({ _id: invoice.rentCycle }, { $set: {
        paidAmount: invoice.paidAmount,
        outstandingAmount: invoice.balanceAmount,
        status: invoice.status === 'partially_paid' ? 'partial' : invoice.status,
        ...(invoice.status === 'paid' ? { closedAt: now } : {}),
        updatedBy: actor.userId || payment.payee,
      } });
    }
    await Promise.all([invoice.tenant, invoice.landlord].filter(Boolean).map((userId) => Notification.findOneAndUpdate(
      { user: userId, 'metadata.paymentId': payment._id, 'metadata.event': 'rental_payment_approved' },
      { $setOnInsert: {
        user: userId,
        title: userId.toString() === invoice.tenant.toString() ? 'Rent payment accepted' : 'Rent payment recorded',
        message: `${invoice.invoiceNumber} is ${invoice.status === 'paid' ? 'paid in full' : 'partially paid'} for ₹${acceptedAmount.toLocaleString('en-IN')}.`,
        category: 'payment',
        actionUrl: userId.toString() === invoice.tenant.toString()
          ? `/app/my-property/${invoice.tenancy}/rent-cycle`
          : `/app/tenancy_details/${invoice.tenancy}?tab=rent`,
        metadata: { paymentId: payment._id, invoiceId: invoice._id, event: 'rental_payment_approved' },
      } },
      { upsert: true, new: true },
    )));
    await notifyRentReceipt(invoice, payment);
    await notifyPaymentCompleted(payment, payment.payee);
  }


  if (payment.type === 'facility_booking' && payment.facilityBooking) {
    const booking = await FacilityBooking.findById(payment.facilityBooking);
    if (!booking) throw new Error('Facility booking record is missing for this payment');
    booking.payment = payment._id;
    booking.paymentStatus = 'paid';
    booking.updatedBy = actor.userId || payment.payer;
    await booking.save({ validateModifiedOnly: true });
    await Promise.all([booking.owner, booking.requester].filter(Boolean).map((userId) => Notification.findOneAndUpdate(
      { user: userId, 'metadata.paymentId': payment._id, 'metadata.event': 'facility_booking_paid' },
      { $setOnInsert: { user: userId, title: 'Facility booking payment received', message: `${payment.invoiceNumber || 'Facility booking invoice'} has been paid.`, category: 'payment', actionUrl: '/app/facility-bookings', metadata: { paymentId: payment._id, bookingId: booking._id, event: 'facility_booking_paid' } } },
      { upsert: true, new: true },
    )));
  }

  if (!(payment.type === 'rent' && payment.rentalInvoice)) {
    await notifyPaymentCompleted(payment);
  }

  payment.gateway = { ...(payment.gateway || {}), lifecycleAppliedAt: now, lifecycleAppliedBy: actor.userId || null };
  await payment.save({ validateModifiedOnly: true });
  await AuditLog.findOneAndUpdate(
    { action: 'payment:lifecycle-applied', module: 'payments', recordId: payment._id },
    { $setOnInsert: {
    user: actor.userId || payment.payer,
    role: actor.role || 'system',
    action: 'payment:lifecycle-applied',
    module: 'payments',
    recordId: payment._id,
    updatedValue: { type: payment.type, status: payment.status, amount: payment.amount },
    ip: actor.ip,
    device: actor.device,
    } },
    { upsert: true, new: true },
  );
  return payment;
}

export async function pauseExpiredLandlordListings(userId) {
  await Property.updateMany({ owner: userId, requiresActiveSubscription: true }, { visibility: 'private', publicationStatus: 'draft' });
  await PropertySpace.updateMany({ owner: userId }, { visibility: 'private', publicationStatus: 'draft' });
}
