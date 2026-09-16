import {
  User, SurveyorPlan, SurveyorSubscription, SurveyorProfile, SurveyService,
  SurveyQuotation, SurveyProject, SurveyReport, SurveyTeamMember, SurveyClient, Document,
} from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { syncTenantEntitlements } from './tenantEntitlements.js';

export const DEFAULT_SURVEYOR_PLANS = [
  {
    key: 'basic', name: 'Basic Surveyor', rank: 1,
    description: 'For independent professionals starting their digital survey practice.',
    prices: { monthly: 799, yearly: 7990, currency: 'INR' },
    limits: { publicServices: 2, jobsPerMonth: 5, quotationsPerMonth: 10, teamMembers: 0, serviceLocations: 2, storageMb: 500, reportsPerMonth: 5, clients: 30 },
    features: { clientManagement: false, invoicing: false, digitalSignature: false, advancedMapping: false, analytics: false, featuredEligible: false, priorityPlacement: false, integrations: false, privateShareLinks: true, offlineFieldData: true },
    graceDays: 7, supportLevel: 'standard', active: true,
  },
  {
    key: 'professional', name: 'Professional Surveyor', rank: 2,
    description: 'For established surveyors managing recurring clients and projects.',
    prices: { monthly: 1499, yearly: 14990, currency: 'INR' },
    limits: { publicServices: 8, jobsPerMonth: 25, quotationsPerMonth: 50, teamMembers: 2, serviceLocations: 8, storageMb: 3000, reportsPerMonth: 30, clients: 250 },
    features: { clientManagement: true, invoicing: true, digitalSignature: true, advancedMapping: false, analytics: true, featuredEligible: false, priorityPlacement: false, integrations: false, privateShareLinks: true, offlineFieldData: true },
    graceDays: 10, supportLevel: 'priority', active: true,
  },
  {
    key: 'premium', name: 'Premium Surveyor', rank: 3,
    description: 'Advanced mapping, larger limits and promotional eligibility.',
    prices: { monthly: 2799, yearly: 27990, currency: 'INR' },
    limits: { publicServices: 20, jobsPerMonth: 75, quotationsPerMonth: 150, teamMembers: 6, serviceLocations: 20, storageMb: 10000, reportsPerMonth: 100, clients: 1000 },
    features: { clientManagement: true, invoicing: true, digitalSignature: true, advancedMapping: true, analytics: true, featuredEligible: true, priorityPlacement: true, integrations: false, privateShareLinks: true, offlineFieldData: true },
    graceDays: 14, supportLevel: 'priority', active: true,
  },
  {
    key: 'agency', name: 'Survey Agency', rank: 4,
    description: 'Team workflows, reviewer permissions and agency operations.',
    prices: { monthly: 4999, yearly: 49990, currency: 'INR' },
    limits: { publicServices: 50, jobsPerMonth: 250, quotationsPerMonth: 500, teamMembers: 25, serviceLocations: 50, storageMb: 50000, reportsPerMonth: 500, clients: 5000 },
    features: { clientManagement: true, invoicing: true, digitalSignature: true, advancedMapping: true, analytics: true, featuredEligible: true, priorityPlacement: true, integrations: true, privateShareLinks: true, offlineFieldData: true },
    graceDays: 21, supportLevel: 'dedicated', active: true,
  },
  {
    key: 'enterprise', name: 'Enterprise', rank: 5,
    description: 'Configurable limits, integrations and dedicated support for large organisations.',
    prices: { monthly: 9999, yearly: 99990, currency: 'INR' },
    limits: { publicServices: 250, jobsPerMonth: 2000, quotationsPerMonth: 5000, teamMembers: 250, serviceLocations: 250, storageMb: 500000, reportsPerMonth: 5000, clients: 50000 },
    features: { clientManagement: true, invoicing: true, digitalSignature: true, advancedMapping: true, analytics: true, featuredEligible: true, priorityPlacement: true, integrations: true, privateShareLinks: true, offlineFieldData: true },
    graceDays: 30, supportLevel: 'dedicated', active: true,
  },
];

export async function ensureDefaultSurveyorPlans() {
  await Promise.all(DEFAULT_SURVEYOR_PLANS.map((plan) => SurveyorPlan.updateOne(
    { key: plan.key },
    { $setOnInsert: plan },
    { upsert: true },
  )));
  return SurveyorPlan.find({ active: true }).sort('rank').lean();
}

export function currentMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function getLatestSurveyorSubscription(userId) {
  return SurveyorSubscription.findOne({ user: userId }).sort('-createdAt').populate('plan').lean();
}

export async function refreshSurveyorSubscriptionState(userId) {
  const now = new Date();
  const subscription = await SurveyorSubscription.findOne({ user: userId, status: { $nin: ['cancelled', 'suspended', 'expired'] } }).sort('-expiresAt').populate('plan');
  if (!subscription) {
    await syncTenantEntitlements(userId);
    return null;
  }

  const expiry = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
  const graceDays = Number(subscription.planSnapshot?.graceDays ?? subscription.plan?.graceDays ?? 7);
  if (expiry && expiry <= now) {
    const graceEndsAt = subscription.graceEndsAt || new Date(expiry.getTime() + graceDays * 86400000);
    subscription.graceEndsAt = graceEndsAt;
    if (graceEndsAt > now) {
      subscription.status = 'grace_period';
      await syncTenantEntitlements(userId);
    } else {
      subscription.status = 'expired';
      await syncTenantEntitlements(userId);
      await SurveyorProfile.updateMany({ user: userId, visibility: 'public' }, { publicationStatus: 'paused' });
      await SurveyService.updateMany({ surveyor: userId, visibility: 'public', status: { $in: ['published', 'pending_moderation'] } }, { status: 'unpublished' });
    }
    await subscription.save();
  } else if (expiry) {
    const days = (expiry.getTime() - now.getTime()) / 86400000;
    subscription.status = days <= 7 ? 'expiring_soon' : (subscription.status === 'trial' ? 'trial' : 'active');
    await subscription.save();
  }
  await syncTenantEntitlements(userId);
  return subscription.toObject();
}

export async function getActiveSurveyorSubscription(userId, { allowGrace = true } = {}) {
  await refreshSurveyorSubscriptionState(userId);
  const allowed = allowGrace ? ['trial', 'active', 'expiring_soon', 'grace_period'] : ['trial', 'active', 'expiring_soon'];
  const sub = await SurveyorSubscription.findOne({ user: userId, status: { $in: allowed } }).sort('-expiresAt').populate('plan');
  if (!sub) throw new ApiError(403, 'An active Surveyor subscription is required for this action');
  return sub;
}

export async function calculateSurveyorUsage(userId, subscription) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [publicServices, jobs, quotations, teamMembers, reports, clients, documents] = await Promise.all([
    SurveyService.countDocuments({ surveyor: userId, visibility: 'public', status: { $in: ['published', 'pending_moderation'] } }),
    SurveyProject.countDocuments({ surveyor: userId, createdAt: { $gte: start, $lt: end } }),
    SurveyQuotation.countDocuments({ surveyor: userId, createdAt: { $gte: start, $lt: end } }),
    SurveyTeamMember.countDocuments({ owner: userId, status: { $in: ['invited', 'active'] } }),
    SurveyReport.countDocuments({ surveyor: userId, createdAt: { $gte: start, $lt: end } }),
    SurveyClient.countDocuments({ surveyor: userId, status: { $ne: 'blocked' } }),
    Document.aggregate([{ $match: { owner: userId } }, { $group: { _id: null, bytes: { $sum: '$sizeBytes' } } }]),
  ]);
  const limits = subscription.planSnapshot?.limits || subscription.plan?.limits || {};
  const storageBytes = documents[0]?.bytes || 0;
  const used = { publicServices, jobs, quotations, teamMembers, reports, clients, storageBytes };
  const remaining = {
    publicServices: Math.max(0, Number(limits.publicServices || 0) - publicServices),
    jobs: Math.max(0, Number(limits.jobsPerMonth || 0) - jobs),
    quotations: Math.max(0, Number(limits.quotationsPerMonth || 0) - quotations),
    teamMembers: Math.max(0, Number(limits.teamMembers || 0) - teamMembers),
    reports: Math.max(0, Number(limits.reportsPerMonth || 0) - reports),
    clients: Math.max(0, Number(limits.clients || 0) - clients),
    storageBytes: Math.max(0, Number(limits.storageMb || 0) * 1024 * 1024 - storageBytes),
  };
  return { period: currentMonthKey(), limits, used, remaining };
}

export async function assertSurveyorLimit(userId, key) {
  const subscription = await getActiveSurveyorSubscription(userId);
  const usage = await calculateSurveyorUsage(userId, subscription);
  if ((usage.remaining[key] ?? 0) <= 0) throw new ApiError(403, `Your Surveyor plan limit for ${key} has been reached`);
  return { subscription, usage };
}

export async function assertSurveyorFeature(userId, feature) {
  const subscription = await getActiveSurveyorSubscription(userId);
  const features = subscription.planSnapshot?.features || subscription.plan?.features || {};
  if (!features[feature]) throw new ApiError(403, `Your Surveyor plan does not include ${feature}`);
  return subscription;
}
