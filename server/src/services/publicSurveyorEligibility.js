import { SurveyorSubscription, User } from '../models/index.js';

/**
 * Public Surveyor discovery is intentionally narrower than authenticated
 * Surveyor capability access. A profile is discoverable only when its owner
 * is an active tenant, has a current active Surveyor subscription, and that
 * subscription still points to an enabled Surveyor plan.
 */
export async function activePublicSurveyorUserIds() {
  const now = new Date();
  const subscriptions = await SurveyorSubscription.find({
    status: { $in: ['active', 'expiring_soon'] },
    expiresAt: { $gt: now },
  })
    .select('user plan')
    .populate({ path: 'plan', select: 'active' })
    .lean();
  const subscribedUserIds = subscriptions
    .filter((subscription) => subscription.plan && subscription.plan.active !== false)
    .map((subscription) => subscription.user)
    .filter(Boolean);
  if (!subscribedUserIds.length) return [];
  return User.distinct('_id', {
    _id: { $in: subscribedUserIds },
    role: 'tenant',
    status: 'active',
  });
}
