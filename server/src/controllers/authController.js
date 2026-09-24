import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { User, AuditLog, SiteSetting, Tenant } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  hashToken, signVaultPinUnlockToken,
  signTwoFactorChallenge, verifyTwoFactorChallenge, signDeviceUnlockToken,
} from '../utils/tokens.js';
import { env } from '../config/env.js';
import { ensurePersonalDrive } from '../services/driveService.js';
import { maskMobile, sendFast2SmsOtp } from '../services/fast2sms.js';
import { identifierDescriptor, normalizeEmail, normalizeIndianMobile } from '../utils/identity.js';
import {
  consumeBackupCode, createOtpAuthUri, decryptTwoFactorSecret, encryptTwoFactorSecret,
  generateBackupCodes, generateTwoFactorSecret, hashBackupCode, verifyTotp,
} from '../services/twoFactor.js';
import { notifyKycRequired } from '../services/whatsappNotifications.js';
import {
  authenticationOptions, registrationOptions, verifyAuthentication as verifyWebAuthnAuthentication, verifyRegistration as verifyWebAuthnRegistration,
} from '../services/webauthn.js';
import { safeUser } from '../services/safeUser.js';
import { findPendingTenantInvitation, hashTenantInvitationToken } from '../services/tenantInvitations.js';
import { hydrateTenantCapabilities } from '../middleware/auth.js';
import {
  authSessionResponse, clearSessionCookies, currentSessionId, issueServerSession,
  listServerSessions, resolveServerSession, revokeAllServerSessions, revokeOtherServerSessions,
  revokeServerSession, revokeSessionForUser,
} from '../services/serverSession.js';

const passwordRule = z.string().min(8).max(128).refine(
  (value) => /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value),
  'Password must contain at least 8 characters, uppercase, lowercase and a number',
);
const credentialsSchema = z.object({
  identifier: z.string().min(3).max(160).optional(),
  email: z.string().max(160).optional(),
  phone: z.string().max(40).optional(),
  password: z.string().min(8).max(128),
}).refine((data) => Boolean(data.identifier || data.email || data.phone), { message: 'Email or mobile number is required' });
const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().min(10).max(40),
  password: passwordRule,
  invitationToken: z.string().min(40).max(64).optional(),
});

async function authenticationPolicy() {
  const setting = await SiteSetting.findOne({ key: 'default' }).select('authentication').lean();
  return { allowRegistration: true, allowPasswordLogin: true, allowOtpLogin: true, ...(setting?.authentication || {}) };
}
const avatarPath = z.string().max(2048).refine((value) => /^https:\/\//i.test(value) || /^\/site-assets\/[a-zA-Z0-9/_\-.]+$/.test(value), 'Avatar must be a secure image URL or uploaded profile image');
const profileUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  avatar: avatarPath.optional().nullable(),
  region: z.string().max(240).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  state: z.string().max(160).optional().nullable(),
  city: z.string().max(160).optional().nullable(),
}).strict();
const contactChangeSchema = z.object({
  type: z.enum(['email', 'phone']),
  value: z.string().trim().min(3).max(160),
  currentPassword: z.string().min(8).max(128),
}).strict();
const vaultPinOtpSchema = z.object({ otp: z.string().regex(/^\d{6}$/), pin: z.string().regex(/^\d{6}$/) }).strict();
const vaultPinUnlockSchema = z.object({ pin: z.string().regex(/^\d{6}$/) }).strict();

async function audit(req, user, action, updatedValue) {
  await AuditLog.create({ user: user._id, role: user.role, action, module: 'auth', recordId: user._id, updatedValue, ip: req.ip, device: req.get('user-agent') });
}

async function issueSession(user, req, res, options = {}) {
  await hydrateTenantCapabilities(user);
  return issueServerSession(user, req, res, options);
}

function twoFactorChallenge(user) {
  return { requiresTwoFactor: true, challengeToken: signTwoFactorChallenge(user), user: { email: user.email, name: user.name } };
}

async function verifySecondFactor(user, code) {
  const input = String(code || '').trim();
  if (!input) return false;
  if (user.twoFactor?.secretEncrypted) {
    const secret = decryptTwoFactorSecret(user.twoFactor.secretEncrypted);
    if (verifyTotp(secret, input)) return true;
  }
  const consumed = consumeBackupCode(user.twoFactor?.backupCodeHashes || [], input);
  if (consumed.valid) {
    user.twoFactor.backupCodeHashes = consumed.remaining;
    return true;
  }
  return false;
}

function identifierFrom(body) {
  return String(body.identifier || body.email || body.phone || '').trim();
}

function identifierQuery(identifier) {
  return identifierDescriptor(identifier)?.query || null;
}

async function findUserByIdentifier(identifier, select = '') {
  const descriptor = identifierDescriptor(identifier);
  if (!descriptor) return null;
  const request = User.findOne(descriptor.query);
  if (select) request.select(select);
  return request;
}

function generatedOtp() {
  return env.NODE_ENV === 'production' ? String(crypto.randomInt(100000, 1000000)) : env.DEMO_OTP;
}

async function storeAndSendOtp(user, purpose) {
  const mobile = normalizeIndianMobile(user.phone);
  if (!mobile) throw new ApiError(422, 'This account does not have a valid registered mobile number');
  const otp = generatedOtp();
  user.phone = mobile;
  user.otpHash = await bcrypt.hash(otp, 12);
  user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  user.otpPurpose = purpose;
  user.otpAttempts = 0;
  user.otpLastSentAt = new Date();
  await user.save({ validateModifiedOnly: true });
  try {
    await sendFast2SmsOtp({ mobile, otp, name: user.name });
  } catch (error) {
    if (env.NODE_ENV === 'production') throw new ApiError(503, error.message);
    return { otp, delivered: false, warning: error.message };
  }
  return { otp, delivered: true };
}

async function validateStoredOtp(user, otp, purpose) {
  const input = String(otp || '').replace(/\D/g, '');
  const valid = Boolean(
    user?.otpHash && user.otpExpiresAt && user.otpExpiresAt > new Date()
    && user.otpPurpose === purpose && /^\d{6}$/.test(input)
    && await bcrypt.compare(input, user.otpHash)
  );
  if (valid) return true;
  if (user) {
    user.otpAttempts = Number(user.otpAttempts || 0) + 1;
    if (user.otpAttempts >= 5) {
      user.otpHash = undefined; user.otpExpiresAt = undefined; user.otpPurpose = undefined;
    }
    await user.save({ validateModifiedOnly: true });
  }
  return false;
}

function clearOtp(user) {
  user.otpHash = undefined;
  user.otpExpiresAt = undefined;
  user.otpPurpose = undefined;
  user.otpAttempts = 0;
  user.otpLastSentAt = undefined;
}

export const register = asyncHandler(async (req, res) => {
  if (!(await authenticationPolicy()).allowRegistration) throw new ApiError(403, 'New registrations are currently disabled');
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Invalid registration data', parsed.error.flatten());
  const email = normalizeEmail(parsed.data.email);
  const phone = normalizeIndianMobile(parsed.data.phone);
  if (!phone) throw new ApiError(422, 'Enter a valid 10-digit Indian mobile number');
  const tenantInvitation = parsed.data.invitationToken ? await findPendingTenantInvitation(parsed.data.invitationToken) : null;
  if (parsed.data.invitationToken && !tenantInvitation) throw new ApiError(410, 'This tenant invitation is invalid or has expired. Ask the landlord for a new link.');
  if (tenantInvitation && (tenantInvitation.email !== email || tenantInvitation.phone !== phone)) {
    throw new ApiError(422, 'Use the email address and mobile number the landlord invited');
  }

  const [emailUser, phoneUser] = await Promise.all([
    User.findOne(identifierDescriptor(email).query).select('+password +otpHash +otpExpiresAt +otpPurpose +otpAttempts +otpLastSentAt +pendingTenantId +pendingTenantTokenHash'),
    User.findOne(identifierDescriptor(phone).query).select('+password +otpHash +otpExpiresAt +otpPurpose +otpAttempts +otpLastSentAt +pendingTenantId +pendingTenantTokenHash'),
  ]);
  if (emailUser && emailUser.status !== 'pending_verification') throw new ApiError(409, 'An account already exists with this email');
  if (phoneUser && phoneUser.status !== 'pending_verification') throw new ApiError(409, 'An account already exists with this mobile number');
  if (emailUser && phoneUser && String(emailUser._id) !== String(phoneUser._id)) throw new ApiError(409, 'Email and mobile number belong to different pending registrations');

  const user = emailUser || phoneUser || new User();
  user.name = parsed.data.name;
  user.email = email;
  user.phone = phone;
  user.password = parsed.data.password;
  user.role = 'tenant';
  user.status = 'pending_verification';
  user.mobileVerifiedAt = undefined;
  user.pendingTenantId = tenantInvitation?._id;
  user.pendingTenantTokenHash = tenantInvitation ? hashTenantInvitationToken(parsed.data.invitationToken) : undefined;
  user.refreshTokens = [];
  const delivery = await storeAndSendOtp(user, 'registration');
  res.status(202).json({
    success: true,
    data: { requiresOtpVerification: true, identifier: phone, maskedMobile: maskMobile(phone) },
    message: `Verification OTP sent to ${maskMobile(phone)}`,
    ...(env.NODE_ENV !== 'production' && { developmentOtp: delivery.otp, deliveryWarning: delivery.warning }),
  });
});

export const verifyRegistration = asyncHandler(async (req, res) => {
  const phone = normalizeIndianMobile(req.body.phone || req.body.identifier);
  if (!phone) throw new ApiError(422, 'Enter the mobile number used during registration');
  const user = await User.findOne({ $and: [identifierDescriptor(phone).query, { status: 'pending_verification' }] })
    .select('+otpHash +otpExpiresAt +otpPurpose +otpAttempts +otpLastSentAt +refreshTokens +pendingTenantId +pendingTenantTokenHash');
  if (!user || !(await validateStoredOtp(user, req.body.otp, 'registration'))) throw new ApiError(401, 'OTP is invalid or expired');
  clearOtp(user);
  user.phone = phone;
  user.mobileVerifiedAt = new Date();
  user.status = 'active';
  await user.save({ validateModifiedOnly: true });
  if (user.pendingTenantId) {
    await Tenant.findOneAndUpdate({
      _id: user.pendingTenantId,
      invitationTokenHash: user.pendingTenantTokenHash,
      invitationStatus: 'pending',
      invitationExpiresAt: { $gt: new Date() },
      email: user.email,
      phone,
    }, {
      $set: { user: user._id, name: user.name, invitationStatus: 'registered' },
      $unset: { invitationTokenHash: 1, invitationExpiresAt: 1 },
    });
    user.pendingTenantId = undefined;
    user.pendingTenantTokenHash = undefined;
    await user.save({ validateModifiedOnly: true });
  }
  await ensurePersonalDrive(user._id);
  const session = await issueSession(user, req, res);
  await audit(req, user, 'account:registered_mobile_verified');
  await notifyKycRequired(user);
  res.status(201).json({ success: true, data: session, message: 'Mobile verified and account created' });
});

export const resendRegistrationOtp = asyncHandler(async (req, res) => {
  const phone = normalizeIndianMobile(req.body.phone || req.body.identifier);
  if (!phone) throw new ApiError(422, 'Enter the mobile number used during registration');
  const user = await User.findOne({ $and: [identifierDescriptor(phone).query, { status: 'pending_verification' }] })
    .select('+otpHash +otpExpiresAt +otpPurpose +otpAttempts +otpLastSentAt');
  if (!user) return res.json({ success: true, message: 'If the pending account exists, a verification OTP has been sent' });
  const delivery = await storeAndSendOtp(user, 'registration');
  res.json({ success: true, message: `Verification OTP sent to ${maskMobile(user.phone)}`, ...(env.NODE_ENV !== 'production' && { developmentOtp: delivery.otp, deliveryWarning: delivery.warning }) });
});

export const login = asyncHandler(async (req, res) => {
  if (!(await authenticationPolicy()).allowPasswordLogin) throw new ApiError(403, 'Password login is currently disabled');
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Enter a valid email/mobile number and password');
  const identifier = parsed.data.identifier || parsed.data.email || parsed.data.phone;
  const user = await findUserByIdentifier(identifier, '+password +refreshTokens +twoFactor.secretEncrypted +twoFactor.backupCodeHashes');
  if (!user || !(await user.comparePassword(parsed.data.password))) throw new ApiError(401, 'Invalid email/mobile number or password');
  if (user.status === 'pending_verification') throw new ApiError(403, 'Verify your mobile number before signing in');
  if (user.status !== 'active') throw new ApiError(403, `Account is ${user.status}`);
  if (user.twoFactor?.enabled) return res.json({ success: true, data: twoFactorChallenge(user) });
  const session = await issueSession(user, req, res);
  await audit(req, user, 'login');
  res.json({ success: true, data: session });
});

export const completeTwoFactorLogin = asyncHandler(async (req, res) => {
  let payload;
  try { payload = verifyTwoFactorChallenge(String(req.body.challengeToken || '')); } catch { throw new ApiError(401, 'Two-factor challenge is invalid or expired'); }
  const user = await User.findById(payload.sub).select('+refreshTokens +twoFactor.secretEncrypted +twoFactor.backupCodeHashes');
  if (!user || user.status !== 'active' || !user.twoFactor?.enabled) throw new ApiError(401, 'Two-factor challenge is no longer valid');
  if (!(await verifySecondFactor(user, req.body.code))) throw new ApiError(401, 'Authenticator or backup code is invalid');
  user.twoFactor.lastVerifiedAt = new Date();
  const session = await issueSession(user, req, res);
  await audit(req, user, 'login:two_factor_verified');
  res.json({ success: true, data: session });
});

export const refresh = asyncHandler(async (req, res) => {
  // Renewal is rolling and rate-safe: active requests extend the session when
  // it enters the renewal window, rather than rotating the browser cookie on
  // every five-minute activity pulse.
  const session = await resolveServerSession(req, res, { renew: true, allowLegacy: true, forceRotate: false });
  if (!session) throw new ApiError(401, 'Session is missing, expired, or revoked');
  const user = await hydrateTenantCapabilities(session.user);
  res.json({ success: true, data: authSessionResponse(session.record, user) });
});

export const logout = asyncHandler(async (req, res) => {
  await revokeServerSession(req, res);
  res.json({ success: true, message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => res.json({ success: true, data: safeUser(req.user) }));

export const updateMe = asyncHandler(async (req, res) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Invalid profile information', parsed.error.flatten());
  const previous = { name: req.user.name, avatar: req.user.avatar, region: req.user.region, country: req.user.country, state: req.user.state, city: req.user.city };
  Object.assign(req.user, parsed.data);
  if (parsed.data.country !== undefined || parsed.data.state !== undefined || parsed.data.city !== undefined) {
    req.user.region = [req.user.city, req.user.state, req.user.country].filter(Boolean).join(', ');
  }
  await req.user.save({ validateModifiedOnly: true });
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'profile:updated', module: 'auth', recordId: req.user._id, previousValue: previous, updatedValue: parsed.data, ip: req.ip, device: req.get('user-agent') });
  res.json({ success: true, data: safeUser(req.user), message: 'Profile updated' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (!passwordRule.safeParse(newPassword).success) throw new ApiError(422, 'New password must contain at least 8 characters, uppercase, lowercase and a number');
  const user = await User.findById(req.user._id).select('+password +refreshTokens +deviceUnlock');
  if (!user || !(await user.comparePassword(currentPassword))) throw new ApiError(401, 'Current password is incorrect');
  user.password = newPassword;
  user.deviceUnlock = { enabled: false, credentials: [] };
  const keepSessionId = currentSessionId(req);
  user.refreshTokens = (user.refreshTokens || []).filter((item) => item.sessionId === keepSessionId);
  await user.save();
  await revokeOtherServerSessions(user._id, keepSessionId, 'password_changed');
  await audit(req, user, 'password:changed');
  res.json({ success: true, message: 'Password changed. Other sessions and registered vault devices were signed out.' });
});

function challengeIsValid(hash, expiresAt) {
  return Boolean(hash && expiresAt && new Date(expiresAt) > new Date());
}

export const beginDeviceUnlockSetup = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +deviceUnlock +deviceUnlock.registrationChallengeHash +deviceUnlock.registrationChallengeExpiresAt');
  if (!user || !(await user.comparePassword(String(req.body.currentPassword || '')))) throw new ApiError(401, 'Current password is incorrect');
  user.deviceUnlock ||= { enabled: false, credentials: [] };
  const options = await registrationOptions({ user, credentials: user.deviceUnlock.credentials || [] });
  user.deviceUnlock.registrationChallengeHash = hashToken(options.challenge);
  user.deviceUnlock.registrationChallengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await user.save({ validateModifiedOnly: true });
  res.json({ success: true, data: options, message: 'Confirm your phone screen lock, fingerprint or face unlock to finish setup' });
});

export const completeDeviceUnlockSetup = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+deviceUnlock +deviceUnlock.registrationChallengeHash +deviceUnlock.registrationChallengeExpiresAt');
  const pending = user?.deviceUnlock;
  if (!user || !pending || !challengeIsValid(pending.registrationChallengeHash, pending.registrationChallengeExpiresAt)) throw new ApiError(409, 'Device-unlock setup has expired. Start setup again.');
  if (!req.body?.response || typeof req.body.response !== 'object') throw new ApiError(422, 'The device-unlock response is invalid');
  let result;
  try {
    result = await verifyWebAuthnRegistration({
      response: req.body.response,
      expectedChallenge: (candidate) => hashToken(candidate) === pending.registrationChallengeHash,
    });
  } catch {
    throw new ApiError(422, 'The device could not verify its screen lock, fingerprint or face unlock');
  }
  if (!result.verified || !result.registrationInfo) throw new ApiError(422, 'Device-unlock verification was not completed');
  const info = result.registrationInfo;
  const credential = info.credential;
  const nextCredential = {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: Number(credential.counter || 0),
    transports: req.body.response.response?.transports || undefined,
    deviceType: info.credentialDeviceType,
    backedUp: Boolean(info.credentialBackedUp),
    createdAt: new Date(),
    lastUsedAt: new Date(),
  };
  const credentials = (pending.credentials || []).filter((item) => item.id !== nextCredential.id);
  user.deviceUnlock.credentials = [...credentials, nextCredential].slice(-5);
  user.deviceUnlock.enabled = true;
  user.deviceUnlock.registrationChallengeHash = undefined;
  user.deviceUnlock.registrationChallengeExpiresAt = undefined;
  await user.save({ validateModifiedOnly: true });
  await audit(req, user, 'device_unlock:enabled', { deviceType: nextCredential.deviceType });
  res.json({ success: true, data: { deviceUnlockEnabled: true }, message: 'Device unlock enabled for this account' });
});

export const beginDeviceUnlockAuthentication = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+deviceUnlock +deviceUnlock.authenticationChallengeHash +deviceUnlock.authenticationChallengeExpiresAt');
  if (!user?.deviceUnlock?.enabled || !user.deviceUnlock.credentials?.length) throw new ApiError(409, 'Device unlock is not configured for this account');
  const options = await authenticationOptions({ credentials: user.deviceUnlock.credentials });
  user.deviceUnlock.authenticationChallengeHash = hashToken(options.challenge);
  user.deviceUnlock.authenticationChallengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await user.save({ validateModifiedOnly: true });
  res.json({ success: true, data: options });
});

export const completeDeviceUnlockAuthentication = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+deviceUnlock +deviceUnlock.authenticationChallengeHash +deviceUnlock.authenticationChallengeExpiresAt');
  const pending = user?.deviceUnlock;
  if (!user || !pending?.enabled || !challengeIsValid(pending.authenticationChallengeHash, pending.authenticationChallengeExpiresAt)) throw new ApiError(401, 'Device-unlock request has expired. Try again.');
  const response = req.body?.response;
  const stored = (pending.credentials || []).find((credential) => credential.id === response?.id);
  if (!stored || !response) throw new ApiError(401, 'This device is not registered for vault unlock');
  let result;
  try {
    result = await verifyWebAuthnAuthentication({
      response,
      credential: stored,
      expectedChallenge: (candidate) => hashToken(candidate) === pending.authenticationChallengeHash,
    });
  } catch {
    throw new ApiError(401, 'Fingerprint, face unlock or screen-lock verification failed');
  }
  if (!result.verified) throw new ApiError(401, 'Fingerprint, face unlock or screen-lock verification failed');
  stored.counter = Number(result.authenticationInfo?.newCounter ?? stored.counter ?? 0);
  stored.lastUsedAt = new Date();
  pending.authenticationChallengeHash = undefined;
  pending.authenticationChallengeExpiresAt = undefined;
  await user.save({ validateModifiedOnly: true });
  res.json({ success: true, data: { unlocked: true, token: signDeviceUnlockToken(user, stored.id) }, message: 'Document Vault unlocked' });
});

export const resetDeviceUnlock = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +deviceUnlock');
  if (!user || !(await user.comparePassword(String(req.body.currentPassword || '')))) throw new ApiError(401, 'Current password is incorrect');
  user.deviceUnlock = { enabled: false, credentials: [] };
  await user.save({ validateModifiedOnly: true });
  await audit(req, user, 'device_unlock:reset');
  res.json({ success: true, data: { deviceUnlockEnabled: false }, message: 'Device unlock reset. Set it up again on a trusted device.' });
});

export const requestVaultPinOtp = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+vaultPin +vaultPin.otpHash +vaultPin.otpExpiresAt +vaultPin.otpAttempts +vaultPin.otpLastSentAt');
  const mobile = normalizeIndianMobile(user?.phone);
  if (!user || !mobile) throw new ApiError(422, 'Add a valid mobile number to your account before protecting the Document Vault');
  const lastSentAt = user.vaultPin?.otpLastSentAt ? new Date(user.vaultPin.otpLastSentAt).getTime() : 0;
  if (lastSentAt && Date.now() - lastSentAt < 60_000) throw new ApiError(429, 'Wait one minute before requesting another vault security OTP');

  const otp = generatedOtp();
  user.vaultPin ||= { enabled: false };
  user.vaultPin.otpHash = await bcrypt.hash(otp, 12);
  user.vaultPin.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  user.vaultPin.otpAttempts = 0;
  user.vaultPin.otpLastSentAt = new Date();
  await user.save({ validateModifiedOnly: true });

  let deliveryWarning = '';
  try {
    await sendFast2SmsOtp({ mobile, otp, name: user.name });
  } catch (error) {
    if (env.NODE_ENV === 'production') {
      user.vaultPin.otpHash = undefined;
      user.vaultPin.otpExpiresAt = undefined;
      user.vaultPin.otpLastSentAt = undefined;
      await user.save({ validateModifiedOnly: true });
      throw new ApiError(503, error.message);
    }
    deliveryWarning = error.message;
  }

  res.json({
    success: true,
    data: { maskedMobile: maskMobile(mobile) },
    message: `Vault security OTP sent to ${maskMobile(mobile)}`,
    ...(env.NODE_ENV !== 'production' && { developmentOtp: otp, deliveryWarning }),
  });
});

export const setVaultPin = asyncHandler(async (req, res) => {
  const parsed = vaultPinOtpSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Enter the six-digit SMS verification code and a six-digit vault security code');
  const user = await User.findById(req.user._id).select('+vaultPin +vaultPin.pinHash +vaultPin.otpHash +vaultPin.otpExpiresAt +vaultPin.otpAttempts +vaultPin.otpLastSentAt +vaultPin.failedAttempts +vaultPin.lockedUntil');
  const pinState = user?.vaultPin;
  const valid = Boolean(pinState?.otpHash && pinState.otpExpiresAt && pinState.otpExpiresAt > new Date() && Number(pinState.otpAttempts || 0) < 5 && await bcrypt.compare(parsed.data.otp, pinState.otpHash));
  if (!valid) {
    if (pinState?.otpHash) {
      pinState.otpAttempts = Number(pinState.otpAttempts || 0) + 1;
      if (pinState.otpAttempts >= 5) {
        pinState.otpHash = undefined;
        pinState.otpExpiresAt = undefined;
      }
      await user.save({ validateModifiedOnly: true });
    }
    throw new ApiError(401, 'The SMS verification code is invalid or expired');
  }

  const wasEnabled = Boolean(pinState.enabled);
  pinState.pinHash = await bcrypt.hash(parsed.data.pin, 12);
  pinState.enabled = true;
  pinState.version = Number(pinState.version || 0) + 1;
  pinState.failedAttempts = 0;
  pinState.lockedUntil = undefined;
  pinState.otpHash = undefined;
  pinState.otpExpiresAt = undefined;
  pinState.otpAttempts = 0;
  await user.save({ validateModifiedOnly: true });
  await audit(req, user, wasEnabled ? 'vault_pin:changed' : 'vault_pin:enabled');
  res.json({ success: true, data: { vaultPinEnabled: true, token: signVaultPinUnlockToken(user) }, message: wasEnabled ? 'Document Vault security code changed' : 'Document Vault security enabled' });
});

export const unlockVaultPin = asyncHandler(async (req, res) => {
  const parsed = vaultPinUnlockSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Enter your six-digit Document Vault security code');
  const user = await User.findById(req.user._id).select('+vaultPin +vaultPin.pinHash +vaultPin.failedAttempts +vaultPin.lockedUntil');
  const pinState = user?.vaultPin;
  if (!user || !pinState?.enabled || !pinState.pinHash) throw new ApiError(409, 'Document Vault security is not configured');
  const now = Date.now();
  const lockedUntil = pinState.lockedUntil ? new Date(pinState.lockedUntil).getTime() : 0;
  if (lockedUntil > now) throw new ApiError(423, 'Too many incorrect codes. Change your security code using SMS verification or try again later.');

  const valid = await bcrypt.compare(parsed.data.pin, pinState.pinHash);
  if (!valid) {
    pinState.failedAttempts = Number(pinState.failedAttempts || 0) + 1;
    if (pinState.failedAttempts >= 5) {
      pinState.failedAttempts = 0;
      pinState.lockedUntil = new Date(now + 15 * 60 * 1000);
    }
    await user.save({ validateModifiedOnly: true });
    throw new ApiError(401, pinState.lockedUntil ? 'Too many incorrect codes. Change your security code using SMS verification or try again later.' : 'The Document Vault security code is incorrect');
  }

  pinState.failedAttempts = 0;
  pinState.lockedUntil = undefined;
  await user.save({ validateModifiedOnly: true });
  await audit(req, user, 'vault_pin:unlocked');
  res.json({ success: true, data: { unlocked: true, token: signVaultPinUnlockToken(user) }, message: 'Document Vault unlocked' });
});

export const requestContactChange = asyncHandler(async (req, res) => {
  const parsed = contactChangeSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Enter a valid contact type, value and current password');
  const user = await User.findById(req.user._id).select('+password +pendingContactChange +pendingContactChange.otpHash +pendingContactChange.expiresAt +pendingContactChange.attempts');
  if (!user || !(await user.comparePassword(parsed.data.currentPassword))) throw new ApiError(401, 'Current password is incorrect');
  const value = parsed.data.type === 'email' ? normalizeEmail(parsed.data.value) : normalizeIndianMobile(parsed.data.value);
  if (!value) throw new ApiError(422, parsed.data.type === 'email' ? 'Enter a valid email address' : 'Enter a valid 10-digit Indian mobile number');
  if (value === (parsed.data.type === 'email' ? user.email : user.phone)) throw new ApiError(422, 'This is already your current contact');
  const conflict = await User.findOne(parsed.data.type === 'email' ? { $or: [{ emailNormalized: value }, { email: value }] } : { $or: [{ phoneNormalized: value }, { phone: value }] }).select('_id').lean();
  if (conflict && String(conflict._id) !== String(user._id)) throw new ApiError(409, `That ${parsed.data.type === 'email' ? 'email' : 'mobile number'} is already in use`);
  const deliveryMobile = parsed.data.type === 'phone' ? value : normalizeIndianMobile(user.phone);
  if (!deliveryMobile) throw new ApiError(422, 'A verified registered mobile number is required to change this contact');
  const otp = generatedOtp();
  user.pendingContactChange = {
    type: parsed.data.type,
    value,
    otpHash: await bcrypt.hash(otp, 12),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    requestedAt: new Date(),
  };
  await user.save({ validateModifiedOnly: true });
  let delivery;
  try {
    delivery = await sendFast2SmsOtp({ mobile: deliveryMobile, otp, name: user.name });
  } catch (error) {
    if (env.NODE_ENV === 'production') throw new ApiError(503, error.message);
    delivery = { delivered: false, warning: error.message };
  }
  res.json({ success: true, data: { type: parsed.data.type, maskedMobile: maskMobile(deliveryMobile) }, message: `Verification OTP sent to ${maskMobile(deliveryMobile)}`, ...(env.NODE_ENV !== 'production' && { developmentOtp: otp, deliveryWarning: delivery?.warning }) });
});

export const verifyContactChange = asyncHandler(async (req, res) => {
  const type = z.enum(['email', 'phone']).safeParse(req.body?.type);
  const otp = String(req.body?.otp || '').replace(/\D/g, '');
  if (!type.success || !/^\d{6}$/.test(otp)) throw new ApiError(422, 'Enter the six-digit verification OTP');
  const user = await User.findById(req.user._id).select('+pendingContactChange +pendingContactChange.otpHash +pendingContactChange.expiresAt +pendingContactChange.attempts +refreshTokens');
  const pending = user?.pendingContactChange;
  const valid = Boolean(user && pending?.type === type.data && pending.otpHash && pending.expiresAt > new Date() && pending.attempts < 5 && await bcrypt.compare(otp, pending.otpHash));
  if (!valid) {
    if (user?.pendingContactChange) {
      user.pendingContactChange.attempts = Number(user.pendingContactChange.attempts || 0) + 1;
      if (user.pendingContactChange.attempts >= 5) user.pendingContactChange = undefined;
      await user.save({ validateModifiedOnly: true });
    }
    throw new ApiError(401, 'Verification OTP is invalid or expired');
  }
  const conflict = await User.findOne(type.data === 'email' ? { $or: [{ emailNormalized: pending.value }, { email: pending.value }] } : { $or: [{ phoneNormalized: pending.value }, { phone: pending.value }] }).select('_id').lean();
  if (conflict && String(conflict._id) !== String(user._id)) throw new ApiError(409, `That ${type.data === 'email' ? 'email' : 'mobile number'} is already in use`);
  if (type.data === 'email') user.email = pending.value;
  else { user.phone = pending.value; user.mobileVerifiedAt = new Date(); }
  user.pendingContactChange = undefined;
  const current = currentSessionId(req);
  user.refreshTokens = (user.refreshTokens || []).filter((item) => item.sessionId === current);
  await user.save({ validateModifiedOnly: true });
  await revokeOtherServerSessions(user._id, current, 'contact_changed');
  await audit(req, user, `contact:${type.data}_changed`);
  res.json({ success: true, data: safeUser(user), message: `${type.data === 'email' ? 'Email' : 'Mobile number'} updated successfully. Other sessions were signed out.` });
});

export const sendOtp = asyncHandler(async (req, res) => {
  if (!(await authenticationPolicy()).allowOtpLogin) throw new ApiError(403, 'OTP login is currently disabled');
  const identifier = identifierFrom(req.body);
  if (!identifierQuery(identifier)) throw new ApiError(422, 'Enter a valid email address or Indian mobile number');
  const user = await findUserByIdentifier(identifier, '+otpHash +otpExpiresAt +otpPurpose +otpAttempts +otpLastSentAt');
  if (!user || user.status !== 'active') return res.json({ success: true, message: 'If the account exists, an OTP has been sent to its registered mobile' });
  const delivery = await storeAndSendOtp(user, 'login');
  res.json({ success: true, message: `OTP sent to ${maskMobile(user.phone)}`, data: { maskedMobile: maskMobile(user.phone) }, ...(env.NODE_ENV !== 'production' && { developmentOtp: delivery.otp, deliveryWarning: delivery.warning }) });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const identifier = identifierFrom(req.body);
  const user = await findUserByIdentifier(identifier, '+otpHash +otpExpiresAt +otpPurpose +otpAttempts +otpLastSentAt +refreshTokens +twoFactor.secretEncrypted +twoFactor.backupCodeHashes');
  if (!user || user.status !== 'active' || !(await validateStoredOtp(user, req.body.otp, 'login'))) throw new ApiError(401, 'OTP is invalid or expired');
  clearOtp(user);
  await user.save({ validateModifiedOnly: true });
  if (user.twoFactor?.enabled) return res.json({ success: true, data: twoFactorChallenge(user) });
  const session = await issueSession(user, req, res);
  await audit(req, user, 'login:otp');
  res.json({ success: true, data: session });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const identifier = identifierFrom(req.body);
  if (!identifierQuery(identifier)) throw new ApiError(422, 'Enter a valid registered email address or mobile number');
  const user = await findUserByIdentifier(identifier, '+otpHash +otpExpiresAt +otpPurpose +otpAttempts +otpLastSentAt');
  if (!user || user.status !== 'active') return res.json({ success: true, message: 'If the account exists, a password reset OTP has been sent to its registered mobile' });
  const delivery = await storeAndSendOtp(user, 'password_reset');
  res.json({ success: true, message: `Password reset OTP sent to ${maskMobile(user.phone)}`, data: { maskedMobile: maskMobile(user.phone) }, ...(env.NODE_ENV !== 'production' && { developmentOtp: delivery.otp, deliveryWarning: delivery.warning }) });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const identifier = identifierFrom(req.body);
  const password = String(req.body.password || '');
  if (!identifierQuery(identifier)) throw new ApiError(422, 'Enter the registered email address or mobile number');
  if (!passwordRule.safeParse(password).success) throw new ApiError(422, 'Password must contain at least 8 characters, uppercase, lowercase and a number');
  const user = await findUserByIdentifier(identifier, '+password +otpHash +otpExpiresAt +otpPurpose +otpAttempts +otpLastSentAt +refreshTokens +deviceUnlock');
  if (!user || user.status !== 'active' || !(await validateStoredOtp(user, req.body.otp, 'password_reset'))) throw new ApiError(401, 'OTP is invalid or expired');
  user.password = password;
  user.refreshTokens = [];
  user.deviceUnlock = { enabled: false, credentials: [] };
  clearOtp(user);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();
  await revokeAllServerSessions(user._id, 'password_reset');
  await audit(req, user, 'password:reset_mobile_otp');
  clearSessionCookies(res);
  res.json({ success: true, message: 'Password reset successfully. Registered vault devices were signed out. Sign in with your new password.' });
});

export const getSecurityOverview = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+refreshTokens +deviceUnlock +vaultPin');
  const current = currentSessionId(req);
  const sessions = await listServerSessions(req.user._id, current);
  res.json({ success: true, data: { twoFactorEnabled: Boolean(user.twoFactor?.enabled), deviceUnlockEnabled: Boolean(user.deviceUnlock?.enabled && user.deviceUnlock?.credentials?.length), vaultPinEnabled: Boolean(user.vaultPin?.enabled), sessions } });
});

export const beginTwoFactorSetup = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactor.pendingSecretEncrypted');
  if (user.twoFactor?.enabled) throw new ApiError(409, 'Two-factor authentication is already enabled');
  const secret = generateTwoFactorSecret();
  user.twoFactor ||= {}; user.twoFactor.pendingSecretEncrypted = encryptTwoFactorSecret(secret);
  await user.save({ validateModifiedOnly: true });
  res.json({ success: true, data: { secret, otpauthUri: createOtpAuthUri({ secret, email: user.email, issuer: 'SecureAsset' }) } });
});

export const enableTwoFactor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +twoFactor.pendingSecretEncrypted +twoFactor.secretEncrypted +twoFactor.backupCodeHashes');
  if (!user || !(await user.comparePassword(String(req.body.password || '')))) throw new ApiError(401, 'Password is incorrect');
  if (!user.twoFactor?.pendingSecretEncrypted) throw new ApiError(409, 'Start two-factor setup first');
  const secret = decryptTwoFactorSecret(user.twoFactor.pendingSecretEncrypted);
  if (!verifyTotp(secret, req.body.code)) throw new ApiError(422, 'Authenticator code is invalid');
  const backupCodes = generateBackupCodes();
  user.twoFactor.secretEncrypted = encryptTwoFactorSecret(secret); user.twoFactor.pendingSecretEncrypted = undefined;
  user.twoFactor.backupCodeHashes = backupCodes.map(hashBackupCode); user.twoFactor.enabled = true; user.twoFactor.enabledAt = new Date(); user.twoFactor.lastVerifiedAt = new Date();
  await user.save({ validateModifiedOnly: true }); await audit(req, user, 'two_factor:enabled');
  res.json({ success: true, data: { backupCodes }, message: 'Two-factor authentication enabled. Store the backup codes securely.' });
});

export const disableTwoFactor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +twoFactor.secretEncrypted +twoFactor.backupCodeHashes');
  if (!user || !(await user.comparePassword(String(req.body.password || '')))) throw new ApiError(401, 'Password is incorrect');
  if (!user.twoFactor?.enabled) throw new ApiError(409, 'Two-factor authentication is not enabled');
  if (!(await verifySecondFactor(user, req.body.code))) throw new ApiError(401, 'Authenticator or backup code is invalid');
  user.twoFactor = { enabled: false }; await user.save({ validateModifiedOnly: true }); await audit(req, user, 'two_factor:disabled');
  res.json({ success: true, message: 'Two-factor authentication disabled' });
});

export const regenerateBackupCodes = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +twoFactor.secretEncrypted +twoFactor.backupCodeHashes');
  if (!user?.twoFactor?.enabled) throw new ApiError(409, 'Two-factor authentication is not enabled');
  if (!(await user.comparePassword(String(req.body.password || ''))) || !(await verifySecondFactor(user, req.body.code))) throw new ApiError(401, 'Password or authenticator code is invalid');
  const backupCodes = generateBackupCodes(); user.twoFactor.backupCodeHashes = backupCodes.map(hashBackupCode); await user.save({ validateModifiedOnly: true });
  await audit(req, user, 'two_factor:backup_codes_regenerated');
  res.json({ success: true, data: { backupCodes } });
});

export const revokeSession = asyncHandler(async (req, res) => {
  const revoked = await revokeSessionForUser(req.user._id, req.params.sessionId);
  if (!revoked) throw new ApiError(404, 'Session not found');
  if (req.params.sessionId === currentSessionId(req)) clearSessionCookies(res);
  await audit(req, req.user, 'session:revoked', { sessionId: req.params.sessionId });
  res.json({ success: true, message: 'Session revoked' });
});

export const revokeOtherSessions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user || !(await user.comparePassword(String(req.body.password || '')))) throw new ApiError(401, 'Password is incorrect');
  const current = currentSessionId(req);
  await revokeOtherServerSessions(user._id, current);
  await audit(req, user, 'sessions:others_revoked');
  res.json({ success: true, message: 'All other sessions were signed out' });
});
