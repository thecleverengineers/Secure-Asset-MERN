import { User } from '../models/index.js';
import { verifyAccessToken, verifyDeviceUnlockToken, verifyVaultPinUnlockToken } from '../utils/tokens.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { syncTenantEntitlements } from '../services/tenantEntitlements.js';
import { resolveServerSession } from '../services/serverSession.js';

export async function hydrateTenantCapabilities(user) {
  if (!user || user.role !== 'tenant') return user;
  const entitlements = await syncTenantEntitlements(user._id);
  user.landlordEnabled = entitlements.landlord.enabled;
  user.landlordSubscriptionExpiresAt = entitlements.landlord.expiresAt;
  user.landlordPlan = entitlements.landlord.plan;
  user.surveyorEnabled = entitlements.surveyor.enabled;
  user.surveyorSubscriptionExpiresAt = entitlements.surveyor.expiresAt;
  user.surveyorPlan = entitlements.surveyor.plan;
  user.activeMode = entitlements.activeMode;
  return user;
}

export const authenticate = asyncHandler(async (req, res, next) => {
  const serverSession = await resolveServerSession(req, res, { renew: true, allowLegacy: true });
  if (serverSession?.user) {
    req.user = await hydrateTenantCapabilities(serverSession.user);
    req.session = serverSession;
    req.authMethod = 'server-session';
    return next();
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required');
  let payload;
  try { payload = verifyAccessToken(token); } catch { throw new ApiError(401, 'Access token is invalid or expired'); }
  const user = await User.findById(payload.sub).select('-refreshTokens');
  if (!user || user.status !== 'active') throw new ApiError(401, 'Account is unavailable');
  req.user = await hydrateTenantCapabilities(user);
  req.authMethod = 'legacy-bearer';
  next();
});

export const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const serverSession = await resolveServerSession(req, res, { renew: true, allowLegacy: true });
  if (serverSession?.user) {
    req.user = await hydrateTenantCapabilities(serverSession.user);
    req.session = serverSession;
    req.authMethod = 'server-session';
    return next();
  }
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  try {
    const payload = verifyAccessToken(header.slice(7));
    const user = await User.findById(payload.sub).select('-refreshTokens');
    if (user?.status === 'active') {
      req.user = await hydrateTenantCapabilities(user);
      req.authMethod = 'legacy-bearer';
    }
  } catch { /* public route stays anonymous */ }
  next();
});

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new ApiError(403, 'You do not have permission to perform this action'));
  const role = String(req.user.role || '').toLowerCase();
  const allowed = roles.includes(role) || (role === 'super_admin' && (roles.includes('super_admin') || roles.includes('admin')));
  if (!allowed) return next(new ApiError(403, 'You do not have permission to perform this action'));
  next();
};

function isMobileOrTabletRequest(req) {
  return /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(req.get('user-agent') || '');
}

// A configured Vault PIN is the mandatory baseline credential. On a trusted
// phone/tablet with WebAuthn enrolled, a successful fingerprint/face/screen-lock
// assertion is an alternative unlock method — users never have to pass both
// biometric verification and the six-digit PIN in the same unlock attempt.
export const requireDeviceUnlock = asyncHandler(async (req, _res, next) => {
  const mobileRequest = isMobileOrTabletRequest(req);
  const user = await User.findById(req.user._id).select('+deviceUnlock +vaultPin');
  const pinEnabled = Boolean(user?.vaultPin?.enabled);
  const deviceEnabled = Boolean(mobileRequest && user?.deviceUnlock?.enabled && user.deviceUnlock.credentials?.length);

  const vaultToken = req.get('x-secureasset-vault-pin-unlock');
  if (pinEnabled && vaultToken) {
    try {
      const payload = verifyVaultPinUnlockToken(vaultToken);
      if (String(payload.sub) === String(req.user._id) && Number(payload.ver) === Number(user.vaultPin.version || 0)) return next();
    } catch {
      // A valid registered-device token can still satisfy the alternative gate.
    }
  }

  const deviceToken = req.get('x-secureasset-device-unlock');
  if (deviceEnabled && deviceToken) {
    try {
      const payload = verifyDeviceUnlockToken(deviceToken);
      if (String(payload.sub) === String(req.user._id) && user.deviceUnlock.credentials.some((credential) => credential.id === payload.cid)) return next();
    } catch {
      // Fall through to a single clear locked response below.
    }
  }

  if (pinEnabled) {
    throw new ApiError(
      423,
      deviceEnabled
        ? 'Unlock the Document Vault with your six-digit security code or fingerprint/device verification'
        : 'Enter your six-digit security code to unlock the Document Vault',
    );
  }

  // Legacy accounts that enrolled device unlock before creating a Vault PIN
  // remain protected by their registered platform authenticator until the UI
  // guides them through mandatory PIN creation.
  if (deviceEnabled) {
    throw new ApiError(423, 'Device unlock is required before accessing the mobile Document Vault');
  }

  next();
});

export const authorizeSurveyorMode = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  if (['super_admin', 'admin', 'surveyor'].includes(req.user.role)) return next();
  if (req.user.role !== 'tenant') throw new ApiError(403, 'Surveyor features are not available for this account');
  const { getActiveSurveyorSubscription } = await import('../services/surveyorSubscription.js');
  await getActiveSurveyorSubscription(req.user._id);
  next();
});
