import { LandlordPlan, Subscription, Property, PropertySpace, RentalUnit, Tenancy, User } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { effectiveSubscriptionExpiry, syncTenantEntitlements } from './tenantEntitlements.js';

export const DEFAULT_LANDLORD_PLANS = [
  { key: 'starter', name: 'Starter', description: 'For a single building or a small rental portfolio.', rank: 1, active: true, prices: { monthly: 299, yearly: 2990, currency: 'INR' }, limits: { properties: 2, buildings: 1, apartments: 5, rooms: 20, beds: 20, publicListings: 3, activeTenants: 20, storageMB: 5120, teamMembers: 1 }, features: { rentAutomation: false, advancedReports: false, propertyPromotions: false, tenantInterviews: true, utilityBilling: true, multipleBranches: false, customRoles: false, apiAccess: false, prioritySupport: false }, graceDays: 7 },
  { key: 'professional', name: 'Professional', description: 'For growing landlords who need automation and analytics.', rank: 2, active: true, featured: true, prices: { monthly: 699, yearly: 6990, currency: 'INR' }, limits: { properties: 10, buildings: 5, apartments: 25, rooms: 100, beds: 150, publicListings: 25, activeTenants: 120, storageMB: 51200, teamMembers: 5 }, features: { rentAutomation: true, advancedReports: true, propertyPromotions: true, tenantInterviews: true, utilityBilling: true, multipleBranches: false, customRoles: false, apiAccess: false, prioritySupport: true }, graceDays: 10 },
  { key: 'business', name: 'Business', description: 'For multi-property operators and property management teams.', rank: 3, active: true, prices: { monthly: 1499, yearly: 14990, currency: 'INR' }, limits: { properties: 50, buildings: 20, apartments: 100, rooms: 500, beds: 750, publicListings: 100, activeTenants: 600, storageMB: 204800, teamMembers: 25 }, features: { rentAutomation: true, advancedReports: true, propertyPromotions: true, tenantInterviews: true, utilityBilling: true, multipleBranches: true, customRoles: true, apiAccess: true, prioritySupport: true }, graceDays: 14 },
  { key: 'enterprise', name: 'Enterprise', description: 'Custom limits, branches, roles, integrations and dedicated support.', rank: 4, active: true, prices: { monthly: 0, yearly: 0, currency: 'INR' }, limits: { properties: 1000000, buildings: 1000000, apartments: 1000000, rooms: 1000000, beds: 1000000, publicListings: 1000000, activeTenants: 1000000, storageMB: 1048576, teamMembers: 1000000 }, features: { rentAutomation: true, advancedReports: true, propertyPromotions: true, tenantInterviews: true, utilityBilling: true, multipleBranches: true, customRoles: true, apiAccess: true, prioritySupport: true }, graceDays: 30 },
];

export async function ensureLandlordPlans() {
  const count = await LandlordPlan.countDocuments();
  if (!count) await LandlordPlan.insertMany(DEFAULT_LANDLORD_PLANS);
  return LandlordPlan.find({ active: true }).sort({ rank: 1 }).lean();
}

export async function getActiveLandlordSubscription(userId, { required = true } = {}) {
  const now = new Date();
  const candidates = await Subscription.find({ user: userId, status: 'active' }).sort({ expiresAt: -1, createdAt: -1 }).lean();
  const subscription = candidates.find((candidate) => {
    const expiry = effectiveSubscriptionExpiry(candidate, now);
    return expiry && expiry > now;
  }) || null;
  if (subscription && !subscription.expiresAt) {
    const expiresAt = effectiveSubscriptionExpiry(subscription, now);
    await Subscription.updateOne(
      { _id: subscription._id, $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }] },
      { $set: { startsAt: subscription.startsAt || subscription.createdAt || now, expiresAt } },
    );
    subscription.expiresAt = expiresAt;
  }
  if (!subscription && required) throw new ApiError(403, 'Your Landlord subscription is inactive or expired');
  return subscription;
}

export async function landlordUsage(userId) {
  const [properties, buildings, apartments, legacyRooms, rentalRooms, beds, publicProperties, publicSpaces, activeTenants] = await Promise.all([
    Property.countDocuments({ owner: userId, deletedAt: null }),
    PropertySpace.countDocuments({ owner: userId, level: 'building', deletedAt: null }),
    PropertySpace.countDocuments({ owner: userId, level: 'apartment', deletedAt: null }),
    PropertySpace.countDocuments({ owner: userId, level: 'room', deletedAt: null }),
    RentalUnit.countDocuments({ landlord: userId, availabilityStatus: { $ne: 'ARCHIVED' } }),
    PropertySpace.countDocuments({ owner: userId, level: 'bed', deletedAt: null }),
    Property.countDocuments({ owner: userId, visibility: 'public', publicationStatus: 'published', deletedAt: null }),
    PropertySpace.countDocuments({ owner: userId, visibility: 'public', publicationStatus: 'published', deletedAt: null }),
    Tenancy.countDocuments({ landlord: userId, status: { $in: ['reserved', 'application_pending', 'deposit_pending', 'agreement_pending', 'payment_pending', 'active', 'notice', 'notice_period', 'vacating', 'move_out', 'move_out_inspection', 'final_calculation', 'landlord_review', 'final_payment', 'deposit_settlement'] } }),
  ]);
  return { properties, buildings, apartments, rooms: Math.max(legacyRooms, rentalRooms), beds, publicListings: publicProperties + publicSpaces, activeTenants };
}

export async function usageWithLimits(userId) {
  const subscription = await getActiveLandlordSubscription(userId, { required: false });
  const usage = await landlordUsage(userId);
  const limits = subscription?.limits || { properties: 0, buildings: 0, apartments: 0, rooms: 0, beds: 0, publicListings: 0, activeTenants: 0, storageMB: 200, teamMembers: 0 };
  const remaining = Object.fromEntries(Object.entries(usage).map(([key, value]) => [key, Math.max(Number(limits[key] ?? 0) - Number(value), 0)]));
  return { subscription, usage, limits, remaining };
}

export async function assertLandlordLimit(userId, key, increment = 1) {
  const subscription = await getActiveLandlordSubscription(userId);
  const usage = await landlordUsage(userId);
  const limit = Number(subscription.limits?.[key] ?? 0);
  if (Number(usage[key] || 0) + increment > limit) throw new ApiError(403, `Your current Landlord plan allows ${limit} ${key}. Upgrade the plan to continue.`);
  return subscription;
}

export async function syncLandlordLifecycle(userId) {
  const now = new Date();
  const active = await getActiveLandlordSubscription(userId, { required: false });
  if (active) {
    await syncTenantEntitlements(userId);
    return active;
  }
  const activeCandidates = await Subscription.find({ user: userId, status: 'active' }).select('_id startsAt createdAt expiresAt billingCycle').lean();
  const expiredIds = activeCandidates
    .filter((candidate) => {
      const expiry = effectiveSubscriptionExpiry(candidate, now);
      return !expiry || expiry <= now;
    })
    .map((candidate) => candidate._id);
  if (expiredIds.length) await Subscription.updateMany({ _id: { $in: expiredIds }, status: 'active' }, { $set: { status: 'expired' } });
  await syncTenantEntitlements(userId);
  await Property.updateMany({ owner: userId, requiresActiveSubscription: true, visibility: 'public' }, { visibility: 'private', publicationStatus: 'draft' });
  await PropertySpace.updateMany({ owner: userId, visibility: 'public' }, { visibility: 'private', publicationStatus: 'draft' });
  await RentalUnit.updateMany({ landlord: userId, visibility: 'public' }, { visibility: 'private', publicationStatus: 'draft', isAvailable: false });
  return null;
}
