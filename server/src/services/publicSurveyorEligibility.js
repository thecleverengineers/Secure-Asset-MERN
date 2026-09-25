import { SurveyorSubscription, SurveyorVerification, SurveyorProfile, User } from '../models/index.js';

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
    role: { $in: ['tenant', 'surveyor'] },
    status: 'active',
  });
}


function publicSurveyorSlug(name, userId) {
  const base = String(name || 'surveyor')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 70) || 'surveyor';
  return `${base}-${String(userId).slice(-6)}`;
}

/**
 * Existing Surveyors may have been approved before automatic publication was
 * introduced. Reconcile those records whenever the live public directory is
 * requested so verified + actively subscribed Surveyors cannot remain hidden
 * because of stale/missing SurveyorProfile publication fields.
 */
export async function reconcileApprovedPublicSurveyors(subscribedUserIds = []) {
  if (!subscribedUserIds.length) return [];

  const verifications = await SurveyorVerification.find({
    user: { $in: subscribedUserIds },
    status: 'verified',
  })
    .select('user legalName profilePhoto occupation professionalDescription yearsExperience address phone email reviewer')
    .lean();
  if (!verifications.length) return [];

  const verifiedIds = verifications.map((row) => row.user).filter(Boolean);
  const [profiles, users] = await Promise.all([
    SurveyorProfile.find({ user: { $in: verifiedIds } }).lean(),
    User.find({ _id: { $in: verifiedIds }, status: 'active' }).select('name email phone').lean(),
  ]);
  const profileByUser = new Map(profiles.map((row) => [String(row.user), row]));
  const userById = new Map(users.map((row) => [String(row._id), row]));
  const publishableIds = verifications
    .filter((verification) => userById.has(String(verification.user)))
    .map((verification) => verification.user);

  await Promise.all(verifications.map(async (verification) => {
    const user = userById.get(String(verification.user));
    if (!user) return;
    const existing = profileByUser.get(String(verification.user));
    const alreadyPublished = existing
      && existing.visibility === 'public'
      && existing.publicationStatus === 'published'
      && existing.verificationStatus === 'verified';
    if (alreadyPublished) return;

    const name = String(existing?.name || verification.legalName || user.name || 'Verified Surveyor').trim();
    const city = String(verification.address?.city || '').trim();
    const state = String(verification.address?.state || '').trim();

    const officeAddress = {
      ...(existing?.officeAddress || {}),
      line1: existing?.officeAddress?.line1 || verification.address?.line1 || '',
      city: existing?.officeAddress?.city || city,
      state: existing?.officeAddress?.state || state,
      country: existing?.officeAddress?.country || verification.address?.country || 'India',
      postalCode: existing?.officeAddress?.postalCode || verification.address?.postalCode || '',
    };
    const publicContact = {
      ...(existing?.publicContact || {}),
      phone: existing?.publicContact?.phone || verification.phone || user.phone || '',
      email: existing?.publicContact?.email || verification.email || user.email || '',
    };
    const serviceLocations = Array.isArray(existing?.serviceLocations) && existing.serviceLocations.length
      ? existing.serviceLocations
      : (city || state ? [{ city, state, radiusKm: 50 }] : []);

    await SurveyorProfile.findOneAndUpdate(
      { user: verification.user },
      {
        $set: {
          name,
          profilePhoto: existing?.profilePhoto || verification.profilePhoto || '',
          professionalTitle: existing?.professionalTitle || verification.occupation || 'Verified Surveyor',
          description: existing?.description || verification.professionalDescription || 'Verified survey professional.',
          yearsExperience: existing?.yearsExperience ?? verification.yearsExperience,
          serviceLocations,
          officeAddress,
          publicContact,
          publicSlug: existing?.publicSlug || publicSurveyorSlug(name, verification.user),
          visibility: 'public',
          publicationStatus: 'published',
          verificationStatus: 'verified',
          updatedBy: verification.reviewer || verification.user,
        },
        $setOnInsert: {
          user: verification.user,
          createdBy: verification.reviewer || verification.user,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
  }));

  return publishableIds;
}

export async function activeVerifiedPublicSurveyorUserIds() {
  const subscribedUserIds = await activePublicSurveyorUserIds();
  return reconcileApprovedPublicSurveyors(subscribedUserIds);
}
