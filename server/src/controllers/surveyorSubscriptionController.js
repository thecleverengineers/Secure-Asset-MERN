import crypto from 'crypto';
import {
  User, Payment, DriveFile, AuditLog, SurveyorPlan, SurveyorSubscription, SurveyorVerification,
  SurveyorProfile, SurveyService, SurveyJob, SurveyQuotation, SurveyProject, SiteVisit,
  SurveyReport, SurveyReview, SurveyDispute,
} from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import {
  ensureDefaultSurveyorPlans, getLatestSurveyorSubscription, getActiveSurveyorSubscription,
  calculateSurveyorUsage, refreshSurveyorSubscriptionState,
} from '../services/surveyorSubscription.js';
import { applyPaidPayment } from '../services/paymentLifecycle.js';
import { publicRazorpayConfig } from '../services/razorpay.js';
import { env } from '../config/env.js';
import { syncTenantEntitlements } from '../services/tenantEntitlements.js';
import { acceptSurveyQuotation } from '../services/surveyWorkflow.js';

function isInternalPaymentProofUrl(value) {
  return /^\/api\/v1\/drive\/files\/[a-f0-9]{24}\/content$/i.test(String(value || '').trim());
}

async function assertPaymentProofOwner(userId, proofUrl) {
  const fileId = String(proofUrl || '').match(/^\/api\/v1\/drive\/files\/([a-f0-9]{24})\/content$/i)?.[1];
  const file = fileId ? await DriveFile.findOne({ _id: fileId, owner: userId, status: 'active' }).select('mimeType').lean() : null;
  if (!file || !String(file.mimeType || '').startsWith('image/')) throw new ApiError(422, 'Payment screenshot must be an active image uploaded by this account');
}

function addCycle(date, cycle) {
  const result = new Date(date);
  if (cycle === 'yearly') result.setUTCFullYear(result.getUTCFullYear() + 1);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}
function number(prefix) { return `${prefix}-${new Date().getUTCFullYear()}-${Date.now().toString().slice(-9)}`; }
function safeSlug(value) {
  return String(value || 'surveyor').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70);
}
async function writeLog(req, action, module, record, previousValue = undefined) {
  await AuditLog.create({ user: req.user._id, role: req.user.role, action, module, recordId: record?._id, ip: req.ip, device: req.get('user-agent'), previousValue, updatedValue: record?.toObject?.() || record });
}

export const listPlans = asyncHandler(async (_req, res) => {
  const plans = await ensureDefaultSurveyorPlans();
  res.json({ success: true, data: plans });
});

export const mySubscription = asyncHandler(async (req, res) => {
  await ensureDefaultSurveyorPlans();
  await refreshSurveyorSubscriptionState(req.user._id);
  const subscription = await getLatestSurveyorSubscription(req.user._id);
  const [verification, profile] = await Promise.all([
    SurveyorVerification.findOne({ user: req.user._id }).lean(),
    SurveyorProfile.findOne({ user: req.user._id }).lean(),
  ]);
  const usage = subscription && ['trial', 'active', 'expiring_soon', 'grace_period'].includes(subscription.status)
    ? await calculateSurveyorUsage(req.user._id, subscription)
    : null;
  res.json({ success: true, data: { subscription, usage, verification, profile, enabled: Boolean(req.user.surveyorEnabled), activeMode: req.user.activeMode } });
});

export const checkout = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Only tenant accounts can activate Surveyor features');
  await ensureDefaultSurveyorPlans();
  const plan = await SurveyorPlan.findOne({ key: String(req.body.plan || '').toLowerCase(), active: true });
  if (!plan) throw new ApiError(422, 'Invalid Surveyor subscription plan');
  const billingCycle = req.body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
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

  await SurveyorSubscription.updateMany({ user: req.user._id, status: 'payment_pending' }, { $set: { status: 'cancelled', cancelledAt: now } });
  const subscription = await SurveyorSubscription.create({
    user: req.user._id,
    plan: plan._id,
    planKey: plan.key,
    planSnapshot: plan.toObject(),
    billingCycle,
    amount,
    currency: plan.prices.currency || 'INR',
    status: 'payment_pending',
    autoRenew: Boolean(req.body.autoRenew),
    usagePeriod: { month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}` },
    discount: req.body.discount || undefined,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  const payment = await Payment.create({
    invoiceNumber: number('SUR-SUB'),
    payer: req.user._id,
    type: 'surveyor_subscription',
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
    notes: `${plan.name} subscription — awaiting verified payment`,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  if (env.PAYMENT_AUTO_APPROVE) {
    payment.status = 'paid'; payment.paidAmount = amount; payment.paidAt = now; payment.transactionId ||= `DEV-SUR-${Date.now()}`;
    await payment.save();
    await applyPaidPayment(payment, { userId: req.user._id, role: req.user.role, ip: req.ip, device: req.get('user-agent') });
  }
  await writeLog(req, 'surveyor-subscription:checkout-created', 'surveyor-subscriptions', subscription);
  res.status(201).json({ success: true, data: { subscription: await subscription.populate('plan'), payment }, message: env.PAYMENT_AUTO_APPROVE ? 'Surveyor features activated' : 'Payment submitted and awaiting verification' });
});

export const changePlan = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Only tenant accounts can change a Surveyor subscription plan');
  const current = await getActiveSurveyorSubscription(req.user._id);
  const plan = await SurveyorPlan.findOne({ key: String(req.body.plan || '').toLowerCase(), active: true });
  if (!plan) throw new ApiError(422, 'Invalid Surveyor subscription plan');
  if (plan.key === current.planKey) throw new ApiError(409, 'This is already your current plan');
  const amount = Number(plan.prices?.[current.billingCycle] || 0);
  const now = new Date();
  await SurveyorSubscription.updateMany({ user: req.user._id, status: 'payment_pending' }, { $set: { status: 'cancelled', cancelledAt: now } });
  const pending = await SurveyorSubscription.create({
    user: req.user._id, plan: plan._id, planKey: plan.key, planSnapshot: plan.toObject(),
    billingCycle: current.billingCycle, amount, currency: plan.prices.currency || 'INR', status: 'payment_pending',
    autoRenew: current.autoRenew, usagePeriod: current.usagePeriod,
    createdBy: req.user._id, updatedBy: req.user._id,
  });
  const payment = await Payment.create({
    invoiceNumber: number('SUR-CHG'), payer: req.user._id, type: 'surveyor_subscription', amount, paidAmount: 0,
    status: 'pending', dueDate: now, method: ['upi', 'bank_transfer'].includes(req.body.method) ? req.body.method : 'offline',
    proofUrl: req.body.proofUrl ? String(req.body.proofUrl) : undefined,
    gateway: { provider: 'manual', subscriptionId: pending._id, action: 'plan_change', previousSubscriptionId: current._id },
    notes: `${plan.name} plan change — awaiting verified payment`, createdBy: req.user._id, updatedBy: req.user._id,
  });
  if (env.PAYMENT_AUTO_APPROVE) {
    payment.status = 'paid'; payment.paidAmount = amount; payment.paidAt = now; payment.transactionId = `DEV-SUR-CHG-${Date.now()}`;
    await payment.save(); await applyPaidPayment(payment, { userId: req.user._id, role: req.user.role, ip: req.ip, device: req.get('user-agent') });
  }
  await writeLog(req, 'surveyor-subscription:plan-change-requested', 'surveyor-subscriptions', pending, current.toObject());
  res.status(201).json({ success: true, data: { subscription: await pending.populate('plan'), payment }, message: env.PAYMENT_AUTO_APPROVE ? `Plan changed to ${plan.name}` : 'Plan change payment submitted and awaiting verification' });
});

export const renew = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Only tenant accounts can renew a Surveyor subscription');
  await ensureDefaultSurveyorPlans();
  const latest = await SurveyorSubscription.findOne({ user: req.user._id, status: { $in: ['trial', 'active', 'expiring_soon', 'grace_period', 'expired'] } }).sort('-createdAt').populate('plan');
  if (!latest) throw new ApiError(404, 'Surveyor subscription not found');
  const amount = Number(latest.planSnapshot?.prices?.[latest.billingCycle] ?? latest.plan?.prices?.[latest.billingCycle] ?? latest.amount);
  const now = new Date();
  const existingPending = await Payment.findOne({ payer: req.user._id, type: 'surveyor_subscription', status: 'pending', 'gateway.subscriptionId': latest._id, 'gateway.action': 'renewal' }).sort('-createdAt');
  if (existingPending) return res.json({ success: true, data: { subscription: latest, payment: existingPending }, message: 'A renewal payment is already awaiting verification' });
  const payment = await Payment.create({
    invoiceNumber: number('SUR-REN'), payer: req.user._id, type: 'surveyor_subscription', amount, paidAmount: 0,
    status: 'pending', dueDate: now, method: ['upi', 'bank_transfer'].includes(req.body.method) ? req.body.method : 'offline',
    proofUrl: req.body.proofUrl ? String(req.body.proofUrl) : undefined,
    gateway: { provider: 'manual', subscriptionId: latest._id, action: 'renewal' },
    notes: `${latest.planKey} Surveyor renewal — awaiting verified payment`, createdBy: req.user._id, updatedBy: req.user._id,
  });
  if (env.PAYMENT_AUTO_APPROVE) {
    payment.status = 'paid'; payment.paidAmount = amount; payment.paidAt = now; payment.transactionId = `DEV-SUR-REN-${Date.now()}`;
    await payment.save(); await applyPaidPayment(payment, { userId: req.user._id, role: req.user.role, ip: req.ip, device: req.get('user-agent') });
  }
  await writeLog(req, 'surveyor-subscription:renewal-requested', 'surveyor-subscriptions', latest);
  res.status(201).json({ success: true, data: { subscription: latest, payment }, message: env.PAYMENT_AUTO_APPROVE ? 'Surveyor subscription renewed' : 'Renewal payment submitted and awaiting verification' });
});

export const cancel = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Only tenant accounts can cancel a Surveyor subscription');
  const subscription = await SurveyorSubscription.findOne({ _id: req.params.id, user: req.user._id, status: { $in: ['trial', 'active', 'expiring_soon', 'grace_period'] } });
  if (!subscription) throw new ApiError(404, 'Active Surveyor subscription not found');
  const previous = subscription.toObject(); const immediate = Boolean(req.body.immediate);
  subscription.autoRenew = false; subscription.cancelAtPeriodEnd = !immediate; subscription.cancelledAt = new Date(); subscription.updatedBy = req.user._id;
  if (immediate) {
    subscription.status = 'cancelled';
    await syncTenantEntitlements(req.user._id);
    await SurveyorProfile.updateMany({ user: req.user._id, visibility: 'public' }, { publicationStatus: 'paused' });
    await SurveyService.updateMany({ surveyor: req.user._id, visibility: 'public' }, { status: 'unpublished' });
  }
  await subscription.save(); await writeLog(req, 'surveyor-subscription:cancelled', 'surveyor-subscriptions', subscription, previous);
  res.json({ success: true, data: subscription, message: immediate ? 'Surveyor subscription cancelled and public listings paused' : 'Auto-renewal disabled; access continues until the expiry date' });
});

export const switchMode = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Only tenant accounts can change tenant capability mode');
  const mode = String(req.body.mode || 'regular');
  if (!['regular', 'landlord', 'surveyor'].includes(mode)) throw new ApiError(422, 'Invalid account mode');
  const entitlements = await syncTenantEntitlements(req.user._id);
  if (mode === 'landlord' && !entitlements.landlord.enabled) throw new ApiError(403, 'An active Landlord subscription is required');
  if (mode === 'surveyor') await getActiveSurveyorSubscription(req.user._id);
  const user = await User.findOneAndUpdate({ _id: req.user._id, role: 'tenant' }, { $set: { activeMode: mode } }, { new: true });
  res.json({ success: true, data: user, message: `${mode[0].toUpperCase()}${mode.slice(1)} mode activated` });
});

export const getVerification = asyncHandler(async (req, res) => {
  const verification = await SurveyorVerification.findOne({ user: req.user._id }).select('-bankVerification').lean();
  res.json({ success: true, data: verification });
});

export const saveVerification = asyncHandler(async (req, res) => {
  await getActiveSurveyorSubscription(req.user._id);
  const allowed = ['legalName', 'profilePhoto', 'phone', 'email', 'address', 'registrationNumber', 'licenceNumber', 'licenceAuthority', 'licenceIssueDate', 'licenceExpiryDate', 'qualifications', 'certifications', 'yearsExperience', 'taxRegistration', 'businessRegistrationNumber', 'agencyRegistrationNumber', 'insurance', 'serviceAreas', 'documents'];
  const patch = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
  patch.updatedBy = req.user._id;
  const verification = await SurveyorVerification.findOneAndUpdate(
    { user: req.user._id },
    { $set: patch, $setOnInsert: { user: req.user._id, status: 'draft', bankVerification: { status: 'pending' }, createdBy: req.user._id } },
    { upsert: true, new: true, runValidators: true },
  );
  await writeLog(req, 'surveyor-verification:saved', 'surveyor-verifications', verification);
  res.json({ success: true, data: verification });
});

export const submitVerification = asyncHandler(async (req, res) => {
  await getActiveSurveyorSubscription(req.user._id);
  const verification = await SurveyorVerification.findOne({ user: req.user._id });
  if (!verification) throw new ApiError(422, 'Save verification information before submitting');
  const required = ['legalName', 'phone', 'email', 'licenceNumber'];
  const missing = required.filter((key) => !verification[key]);
  if (missing.length) throw new ApiError(422, `Complete the required verification fields: ${missing.join(', ')}`);
  verification.status = 'submitted';
  verification.bankVerification = {
    ...(verification.bankVerification?.toObject?.() || verification.bankVerification || {}),
    status: 'pending',
  };
  verification.submittedAt = new Date();
  verification.updatedBy = req.user._id;
  await verification.save();
  await SurveyorProfile.updateOne({ user: req.user._id }, { verificationStatus: 'pending' });
  await writeLog(req, 'surveyor-verification:submitted', 'surveyor-verifications', verification);
  res.json({ success: true, data: verification, message: 'Verification submitted for review' });
});

export const reviewVerification = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Admin access required');
  const status = String(req.body.status || '');
  if (!['under_review', 'changes_required', 'verified', 'rejected', 'suspended', 'expired'].includes(status)) throw new ApiError(422, 'Invalid verification status');
  const verification = await SurveyorVerification.findById(req.params.id);
  if (!verification) throw new ApiError(404, 'Verification not found');
  const previous = verification.toObject();
  verification.status = status; verification.reviewer = req.user._id; verification.reviewerNotes = req.body.notes; verification.rejectionReason = req.body.rejectionReason; verification.suspensionReason = req.body.suspensionReason; verification.reviewedAt = new Date();
  if (status === 'verified') verification.verifiedAt = new Date();
  await verification.save();
  const profileStatus = status === 'verified' ? 'verified' : status === 'under_review' ? 'pending' : status;
  await SurveyorProfile.updateOne({ user: verification.user }, { verificationStatus: profileStatus, ...(status !== 'verified' && { publicationStatus: 'paused' }) });
  if (status === 'suspended') await SurveyService.updateMany({ surveyor: verification.user, visibility: 'public' }, { status: 'unpublished' });
  await writeLog(req, `surveyor-verification:${status}`, 'surveyor-verifications', verification, previous);
  res.json({ success: true, data: verification });
});

export const createOrUpdateProfile = asyncHandler(async (req, res) => {
  const subscription = await getActiveSurveyorSubscription(req.user._id);
  const allowed = ['profileType', 'name', 'professionalTitle', 'profilePhoto', 'agencyLogo', 'description', 'yearsExperience', 'registrationNumber', 'licenceNumber', 'qualifications', 'certifications', 'specialisations', 'languages', 'serviceLocations', 'officeAddress', 'publicContact', 'workingHours', 'emergencyAvailable', 'portfolio', 'achievements', 'equipmentSummary', 'teamSize', 'availability', 'startingPrice', 'averageCompletionDays', 'terms', 'exactCoordinatesPublic'];
  const patch = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
  if (!patch.name && !(await SurveyorProfile.exists({ user: req.user._id }))) throw new ApiError(422, 'Surveyor or agency name is required');
  if (Array.isArray(patch.serviceLocations) && patch.serviceLocations.length > Number(subscription.planSnapshot?.limits?.serviceLocations || subscription.plan?.limits?.serviceLocations || 0)) throw new ApiError(403, 'Service location limit reached');
  patch.updatedBy = req.user._id;
  const publicSlug = `${safeSlug(patch.name || req.user.name)}-${String(req.user._id).slice(-6)}`;
  const profile = await SurveyorProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: patch, $setOnInsert: { user: req.user._id, publicSlug, visibility: 'private', publicationStatus: 'draft', createdBy: req.user._id } },
    { upsert: true, new: true, runValidators: true },
  );
  await writeLog(req, 'surveyor-profile:saved', 'surveyor-profiles', profile);
  res.json({ success: true, data: profile });
});

export const setProfileVisibility = asyncHandler(async (req, res) => {
  await getActiveSurveyorSubscription(req.user._id);
  const visibility = req.body.visibility === 'public' ? 'public' : 'private';
  const profile = await SurveyorProfile.findOne({ user: req.user._id });
  if (!profile) throw new ApiError(404, 'Create your Surveyor profile first');
  if (visibility === 'public') {
    const verification = await SurveyorVerification.findOne({ user: req.user._id, status: 'verified' });
    if (!verification) throw new ApiError(403, 'Surveyor verification is required before publishing a public profile');
    profile.visibility = 'public'; profile.publicationStatus = 'published'; profile.verificationStatus = 'verified';
  } else { profile.visibility = 'private'; profile.publicationStatus = 'draft'; }
  profile.updatedBy = req.user._id; await profile.save();
  await writeLog(req, `surveyor-profile:${visibility}`, 'surveyor-profiles', profile);
  res.json({ success: true, data: profile });
});

export const createPrivateShareLink = asyncHandler(async (req, res) => {
  const profile = await SurveyorProfile.findOne({ user: req.user._id });
  if (!profile) throw new ApiError(404, 'Surveyor profile not found');
  const token = crypto.randomBytes(24).toString('hex');
  const accessCode = String(req.body.accessCode || '').trim();
  profile.privateShare = { enabled: true, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), passwordHash: accessCode ? crypto.createHash('sha256').update(accessCode).digest('hex') : undefined, revokedAt: undefined };
  await profile.save();
  res.json({ success: true, data: { token, url: `/surveyor-private/${profile._id}?token=${token}` }, message: 'Private profile link created. Store it securely; the token is shown once.' });
});

export const revokePrivateShareLink = asyncHandler(async (req, res) => {
  const profile = await SurveyorProfile.findOne({ user: req.user._id });
  if (!profile) throw new ApiError(404, 'Surveyor profile not found');
  profile.privateShare = { enabled: false, revokedAt: new Date() }; await profile.save();
  res.json({ success: true, data: profile, message: 'Private profile access revoked' });
});

export const dashboard = asyncHandler(async (req, res) => {
  const subscription = await getLatestSurveyorSubscription(req.user._id);
  const usage = subscription && ['trial', 'active', 'expiring_soon', 'grace_period'].includes(subscription.status) ? await calculateSurveyorUsage(req.user._id, subscription) : null;
  const now = new Date();
  const [profile, serviceCounts, jobInvitations, quoteCounts, projectCounts, visits, reportCounts, invoiceTotals, reviewStats] = await Promise.all([
    SurveyorProfile.findOne({ user: req.user._id }).lean(),
    SurveyService.aggregate([{ $match: { surveyor: req.user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    SurveyJob.countDocuments({ invitedSurveyors: req.user._id, status: 'open' }),
    SurveyQuotation.aggregate([{ $match: { surveyor: req.user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    SurveyProject.aggregate([{ $match: { surveyor: req.user._id } }, { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$paymentSummary.total' } } }]),
    SiteVisit.countDocuments({ surveyor: req.user._id, confirmedStart: { $gte: now }, status: { $in: ['requested', 'confirmed', 'rescheduled'] } }),
    SurveyReport.aggregate([{ $match: { surveyor: req.user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { $or: [{ payee: req.user._id }, { payer: req.user._id, type: 'surveyor_payout' }], type: { $in: ['survey_advance', 'survey_milestone', 'survey_final', 'surveyor_payout', 'platform_commission'] } } }, { $group: { _id: '$status', total: { $sum: '$amount' }, paid: { $sum: '$paidAmount' } } }]),
    SurveyReview.aggregate([{ $match: { surveyor: req.user._id, 'moderation.status': 'published' } }, { $group: { _id: null, average: { $avg: '$ratings.overall' }, count: { $sum: 1 } } }]),
  ]);
  const mapCounts = (rows) => Object.fromEntries(rows.map((row) => [row._id, row.count]));
  res.json({ success: true, data: {
    subscription, usage, profile,
    services: mapCounts(serviceCounts), jobInvitations,
    quotations: mapCounts(quoteCounts), projects: mapCounts(projectCounts), upcomingVisits: visits,
    reports: mapCounts(reportCounts), finances: invoiceTotals, reviews: reviewStats[0] || { average: 0, count: 0 },
  } });
});

export const acceptQuotation = asyncHandler(async (req, res) => {
  const result = await acceptSurveyQuotation({ quotationId: req.params.id, actorId: req.user._id, isAdmin: req.user.role === 'admin' });
  await writeLog(req, 'survey-quotation:accepted', 'survey-quotations', result.quotation);
  res.json({ success: true, data: result, message: 'Quotation accepted and project created' });
});

export const finalizeReport = asyncHandler(async (req, res) => {
  await getActiveSurveyorSubscription(req.user._id);
  const report = await SurveyReport.findOne({ _id: req.params.id, surveyor: req.user._id });
  if (!report) throw new ApiError(404, 'Report not found');
  if (report.status === 'locked') throw new ApiError(409, 'Report is already locked');
  const previous = report.toObject();
  report.status = 'locked'; report.lockedAt = new Date(); report.lockedBy = req.user._id; report.issueDate ||= new Date(); report.digitalSignature ||= req.body.digitalSignature; report.updatedBy = req.user._id;
  await report.save();
  await SurveyProject.findByIdAndUpdate(report.project, { status: 'final_report_ready', updatedBy: req.user._id });
  await writeLog(req, 'survey-report:locked', 'survey-reports', report, previous);
  res.json({ success: true, data: report, message: 'Final report locked against unauthorised changes' });
});
