import { capabilityRolesForUser, featureAllowed, rolePermissionDecision } from '../services/rbac.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

async function refreshTenantCapabilities(user) {
  if (String(user?.role || '').toLowerCase() !== 'tenant' || !user?._id) return;
  try {
    const { syncTenantEntitlements } = await import('../services/tenantEntitlements.js');
    const entitlements = await syncTenantEntitlements(user._id);
    user.landlordEnabled = entitlements.landlord.enabled;
    user.landlordSubscriptionExpiresAt = entitlements.landlord.expiresAt;
    user.landlordPlan = entitlements.landlord.plan;
    user.surveyorEnabled = entitlements.surveyor.enabled;
    user.surveyorSubscriptionExpiresAt = entitlements.surveyor.expiresAt;
    user.surveyorPlan = entitlements.surveyor.plan;
    user.activeMode = entitlements.activeMode;
  } catch {
    // Keep the request usable if entitlement synchronization is temporarily
    // unavailable; the persisted user flags remain the safe fallback.
  }
}

export const requireFeaturePermission = (key, action = 'view') => asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  await refreshTenantCapabilities(req.user);
  if (!await featureAllowed(key, req.user, action)) throw new ApiError(403, `Your role is not permitted to ${action} this feature`);
  next();
});

// Capability endpoints must use the subscribed capability's permission map,
// not the tenant's base-role map. This keeps tenants as tenants while making
// an active Landlord/Surveyor subscription additive and independently usable.
export const requireCapabilityPermission = (capability, key, action = 'view') => asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  const normalizedCapability = String(capability || '').trim().toLowerCase();
  if (!['landlord', 'surveyor'].includes(normalizedCapability)) throw new ApiError(500, 'Invalid capability permission configuration');
  await refreshTenantCapabilities(req.user);
  if (!capabilityRolesForUser(req.user).includes(normalizedCapability)) {
    throw new ApiError(403, `An active ${normalizedCapability} subscription is required`);
  }
  const permission = await rolePermissionDecision(normalizedCapability, key, action);
  if (!permission.allowed) throw new ApiError(403, `Your subscribed ${normalizedCapability} capability is not permitted to ${action} this feature`);
  next();
});

export const requireAnyFeaturePermission = (keys, action = 'view') => asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  await refreshTenantCapabilities(req.user);
  const candidates = Array.isArray(keys) ? keys : [keys];
  const allowed = await Promise.any(candidates.map(async (key) => {
    if (await featureAllowed(key, req.user, action)) return true;
    throw new Error('feature denied');
  })).catch(() => false);
  if (!allowed) throw new ApiError(403, `Your role is not permitted to ${action} this feature`);
  next();
});

// Subscription checkout, renewal and cancellation are deliberately tenant
// account operations. Landlord/surveyor capability workspaces are additive
// entitlements on a tenant account; legacy role records must not create new
// plan orders through direct URLs or stale clients.
export const requireTenantSubscriptionAccount = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  if (String(req.user.role || '').trim().toLowerCase() !== 'tenant') {
    throw new ApiError(403, 'Only tenant accounts can activate or manage subscription plans');
  }
  next();
});

// Subscription proof screenshots are part of the subscription checkout workflow,
// not ordinary Document Vault creation. Keep this exception narrow: it accepts
// only an authenticated tenant/admin, only from a payment screen that sends the
// fixed purpose header, and only while at least one subscription module is visible
// to the account. Ordinary /uploads/document remains protected by module:documents
// create permission.
export const requireSubscriptionPaymentProofUpload = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  const role = String(req.user.role || '').trim().toLowerCase();
  if (!['tenant', 'admin'].includes(role)) {
    throw new ApiError(403, 'Only tenant accounts can submit subscription payment proof');
  }
  if (req.get('x-secureasset-upload-purpose') !== 'subscription_payment_proof') {
    throw new ApiError(400, 'Invalid subscription payment proof upload request');
  }
  const landlordSubscriptionVisible = role === 'admin' || await featureAllowed('module:subscription', req.user, 'view');
  const surveyorSubscriptionVisible = role === 'admin' || await featureAllowed('module:surveyor-subscription', req.user, 'view');
  if (!landlordSubscriptionVisible && !surveyorSubscriptionVisible) {
    throw new ApiError(403, 'Your account cannot access subscription payments');
  }
  req.subscriptionPaymentProof = true;
  next();
});


export const requireSurveyorVerificationDocumentUpload = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  const kind = String(req.get('x-secureasset-verification-document') || '').trim().toLowerCase();
  if (!['identity_front', 'identity_back', 'bank_passbook'].includes(kind)) {
    throw new ApiError(400, 'Invalid Surveyor verification document type');
  }
  const { getActiveSurveyorSubscription } = await import('../services/surveyorSubscription.js');
  await getActiveSurveyorSubscription(req.user._id);
  req.surveyorVerificationUpload = { kind };
  next();
});
