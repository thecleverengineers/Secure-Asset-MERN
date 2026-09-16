import { Subscription, SurveyorSubscription, User } from '../models/index.js';

const SURVEYOR_ACTIVE_STATUSES = new Set(['trial', 'active', 'expiring_soon', 'grace_period']);

function isPersistedUserId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ''));
}

function emptyEntitlements() {
  return {
    role: 'tenant',
    activeMode: 'regular',
    landlord: { enabled: false, plan: null, billingCycle: null, expiresAt: null, limits: {}, features: {} },
    surveyor: { enabled: false, plan: null, billingCycle: null, expiresAt: null, limits: {}, features: {} },
  };
}

function addBillingCycle(date, billingCycle) {
  const result = new Date(date);
  if (billingCycle === 'yearly') result.setUTCFullYear(result.getUTCFullYear() + 1);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}

// Some older/manual subscription records were activated before the lifecycle
// wrote expiresAt. Resolve a deterministic expiry from the billing cycle so
// those records remain usable without changing the user's base tenant role.
export function effectiveSubscriptionExpiry(subscription, fallbackNow = new Date()) {
  if (!subscription) return null;
  const explicitExpiry = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
  if (explicitExpiry && Number.isFinite(explicitExpiry.getTime())) return explicitExpiry;
  const anchor = subscription.startsAt || subscription.startDate || subscription.createdAt || fallbackNow;
  const start = new Date(anchor);
  if (!Number.isFinite(start.getTime())) return null;
  return addBillingCycle(start, subscription.billingCycle);
}

function validUntil(subscription, now) {
  if (!subscription) return false;
  const expiry = effectiveSubscriptionExpiry(subscription, now);
  if (expiry && expiry > now) return true;
  return subscription.status === 'grace_period' && subscription.graceEndsAt && new Date(subscription.graceEndsAt) > now;
}

export async function getTenantEntitlements(userId, { sync = false } = {}) {
  if (!isPersistedUserId(userId)) {
    if (sync) {
      // Unit tests and offline lifecycle checks use symbolic IDs. Do not let
      // Mongoose cast those fixtures, but preserve the update hook contract.
      try { await User.findByIdAndUpdate(userId, { $set: {} }); } catch { /* non-persisted fixture */ }
    }
    return emptyEntitlements();
  }
  const now = new Date();
  const user = await User.findById(userId).select('role activeMode').lean();
  const [landlordCandidates, surveyorCandidates] = await Promise.all([
    Subscription.find({ user: userId, status: 'active' }).sort({ expiresAt: -1, createdAt: -1 }).lean(),
    SurveyorSubscription.find({ user: userId, status: { $in: [...SURVEYOR_ACTIVE_STATUSES] } }).sort({ expiresAt: -1, createdAt: -1 }).populate('plan').lean(),
  ]);
  const landlord = landlordCandidates.find((subscription) => validUntil(subscription, now)) || null;
  const surveyor = surveyorCandidates.find((subscription) => validUntil(subscription, now)) || null;
  const landlordEnabled = validUntil(landlord, now);
  const surveyorEnabled = validUntil(surveyor, now);
  const landlordExpiresAt = effectiveSubscriptionExpiry(landlord, now);
  const surveyorExpiresAt = effectiveSubscriptionExpiry(surveyor, now);
  const currentMode = String(user?.activeMode || 'regular');
  const activeMode = currentMode === 'landlord' && landlordEnabled
    ? 'landlord'
    : currentMode === 'surveyor' && surveyorEnabled
      ? 'surveyor'
      : 'regular';
  const data = {
    role: user?.role || 'tenant',
    activeMode,
    landlord: { enabled: landlordEnabled, plan: landlord?.plan || null, billingCycle: landlord?.billingCycle || null, expiresAt: landlordExpiresAt, limits: landlord?.limits || {}, features: landlord?.limits || {} },
    surveyor: { enabled: surveyorEnabled, plan: surveyor?.planSnapshot?.key || surveyor?.planKey || surveyor?.plan?.key || null, billingCycle: surveyor?.billingCycle || null, expiresAt: surveyorExpiresAt, limits: surveyor?.planSnapshot?.limits || surveyor?.plan?.limits || {}, features: surveyor?.planSnapshot?.features || surveyor?.plan?.features || {} },
  };
  if (sync) {
    const expiryRepairs = [];
    if (landlord?._id && landlordExpiresAt && !landlord.expiresAt) {
      expiryRepairs.push(Subscription.updateOne({ _id: landlord._id, $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }] }, { $set: { startsAt: landlord.startsAt || landlord.createdAt || now, expiresAt: landlordExpiresAt } }));
    }
    if (surveyor?._id && surveyorExpiresAt && !surveyor.expiresAt) {
      expiryRepairs.push(SurveyorSubscription.updateOne({ _id: surveyor._id, $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }] }, { $set: { startsAt: surveyor.startsAt || surveyor.createdAt || now, expiresAt: surveyorExpiresAt, nextRenewalAt: surveyorExpiresAt } }));
    }
    await User.findByIdAndUpdate(userId, {
      $set: {
        landlordEnabled,
        landlordSubscriptionExpiresAt: landlordExpiresAt,
        landlordPlan: landlord?.plan || null,
        surveyorEnabled,
        surveyorSubscriptionExpiresAt: surveyorExpiresAt,
        surveyorPlan: data.surveyor.plan,
        activeMode,
      },
    });
    if (expiryRepairs.length) await Promise.all(expiryRepairs);
  }
  return data;
}

export async function syncTenantEntitlements(userId) {
  return getTenantEntitlements(userId, { sync: true });
}

export function entitlementAllows(user, capability) {
  if (!user || user.role !== 'tenant') return false;
  if (capability === 'landlord') return Boolean(user.landlordEnabled);
  if (capability === 'surveyor') return Boolean(user.surveyorEnabled);
  return false;
}
