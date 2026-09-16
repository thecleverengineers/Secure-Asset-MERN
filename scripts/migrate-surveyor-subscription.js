import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { User, SurveyorPlan, SurveyorSubscription, SurveyorVerification, SurveyorProfile } from '../server/src/models/index.js';
import { ensureDefaultSurveyorPlans } from '../server/src/services/surveyorSubscription.js';

function addYear(date = new Date()) { const out = new Date(date); out.setUTCFullYear(out.getUTCFullYear() + 1); return out; }
function slug(value) { return String(value || 'surveyor').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70); }

await connectDatabase();
try {
  await ensureDefaultSurveyorPlans();
  const professional = await SurveyorPlan.findOne({ key: 'professional' });
  const legacy = await User.find({ role: 'surveyor' });
  let converted = 0; let subscriptions = 0; let profiles = 0;
  for (const user of legacy) {
    const now = new Date(); const expiresAt = addYear(now);
    user.role = 'tenant'; user.surveyorEnabled = true; user.activeMode = 'surveyor'; user.surveyorSubscriptionExpiresAt = expiresAt; await user.save(); converted += 1;
    const existing = await SurveyorSubscription.findOne({ user: user._id, status: { $in: ['trial', 'active', 'expiring_soon', 'grace_period'] } });
    if (!existing && professional) {
      await SurveyorSubscription.create({ user: user._id, plan: professional._id, planKey: professional.key, planSnapshot: professional.toObject(), billingCycle: 'yearly', amount: professional.prices.yearly, currency: 'INR', status: 'active', startsAt: now, expiresAt, nextRenewalAt: expiresAt, autoRenew: false, paymentHistory: [{ status: 'paid', amount: professional.prices.yearly, transactionId: `MIGRATED-${user._id}-${Date.now()}`, gateway: 'migration', paidAt: now }], createdBy: user._id, updatedBy: user._id }); subscriptions += 1;
    }
    await SurveyorVerification.updateOne({ user: user._id }, { $setOnInsert: { user: user._id, status: 'draft', legalName: user.name, email: user.email, phone: user.phone, createdBy: user._id, updatedBy: user._id } }, { upsert: true });
    const result = await SurveyorProfile.updateOne({ user: user._id }, { $setOnInsert: { user: user._id, name: user.name, professionalTitle: 'Professional Surveyor', visibility: 'private', publicationStatus: 'draft', verificationStatus: 'not_submitted', publicSlug: `${slug(user.name)}-${String(user._id).slice(-6)}`, createdBy: user._id, updatedBy: user._id } }, { upsert: true });
    if (result.upsertedCount) profiles += 1;
  }
  console.log(`Surveyor migration complete: ${converted} legacy account(s), ${subscriptions} subscription(s), ${profiles} profile(s).`);
} finally { await disconnectDatabase(); }
