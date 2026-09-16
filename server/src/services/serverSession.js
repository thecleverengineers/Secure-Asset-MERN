import crypto from 'node:crypto';
import { AuthSession } from '../models/session.js';
import { User } from '../models/index.js';
import { hashToken, verifyRefreshToken } from '../utils/tokens.js';
import { env } from '../config/env.js';
import { safeUser } from './safeUser.js';

// __Host- prevents a subdomain from setting a parent-domain cookie. Local
// development keeps the readable name so HTTP localhost remains convenient;
// production is HTTPS-only and host-bound.
export const SESSION_COOKIE_NAME = env.NODE_ENV === 'production' ? '__Host-sa_session' : 'sa_session';
export const CSRF_COOKIE_NAME = 'sa_csrf';
const LEGACY_REFRESH_COOKIE_NAME = 'sa_refresh';
const DAY_MS = 86_400_000;
const SESSION_ROLLING_MS = env.SESSION_ROLLING_TTL_DAYS * DAY_MS;
const SESSION_ABSOLUTE_MS = env.SESSION_ABSOLUTE_TTL_DAYS * DAY_MS;
const SESSION_RENEWAL_WINDOW_MS = env.SESSION_RENEWAL_WINDOW_HOURS * 3_600_000;
const ROTATION_GRACE_MS = env.SESSION_ROTATION_GRACE_SECONDS * 1_000;

function nowDate() { return new Date(); }

function randomSessionToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function randomCsrfToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function requestIp(req) {
  return String(req?.ip || req?.socket?.remoteAddress || '').slice(0, 128);
}

function requestDevice(req) {
  return String(req?.get?.('user-agent') || req?.headers?.['user-agent'] || 'Unknown device').slice(0, 500);
}

function cookieBase(httpOnly) {
  return {
    httpOnly,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
  };
}

function maxAgeUntil(expiresAt) {
  return Math.max(0, Math.min(SESSION_ROLLING_MS, new Date(expiresAt).getTime() - Date.now()));
}

function setCsrfCookie(req, res) {
  if (!res?.cookie || req?.cookies?.[CSRF_COOKIE_NAME]) return;
  res.cookie(CSRF_COOKIE_NAME, randomCsrfToken(), {
    ...cookieBase(false),
    maxAge: SESSION_ROLLING_MS,
  });
}

function setSessionCookie(req, res, token, expiresAt) {
  if (!res?.cookie) return;
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...cookieBase(true),
    maxAge: maxAgeUntil(expiresAt),
  });
  setCsrfCookie(req, res);
}

export function clearSessionCookies(res) {
  if (!res?.clearCookie) return;
  res.clearCookie(SESSION_COOKIE_NAME, cookieBase(true));
  res.clearCookie(CSRF_COOKIE_NAME, cookieBase(false));
  // Keep clearing the v97 cookie until the migration window is over.
  res.clearCookie(LEGACY_REFRESH_COOKIE_NAME, { ...cookieBase(true), path: '/api/v1/auth' });
}

function sessionInfo(record) {
  return {
    sessionId: record.sessionId,
    sessionExpiresAt: new Date(record.expiresAt).toISOString(),
    absoluteExpiresAt: new Date(record.absoluteExpiresAt).toISOString(),
  };
}

export function authSessionResponse(record, user) {
  return { user: safeUser(user), ...sessionInfo(record) };
}

function activeSessionFilter(now = nowDate()) {
  return {
    revokedAt: null,
    expiresAt: { $gt: now },
    absoluteExpiresAt: { $gt: now },
  };
}

function tokenFilter(token, now = nowDate()) {
  const digest = hashToken(token);
  return {
    ...activeSessionFilter(now),
    $or: [
      { tokenHash: digest },
      { previousTokenHash: digest, previousTokenExpiresAt: { $gt: now } },
    ],
  };
}

async function loadRawSession(token) {
  if (!token || typeof token !== 'string' || token.length < 64 || token.length > 256) return null;
  const now = nowDate();
  const record = await AuthSession.findOne(tokenFilter(token, now)).select('+tokenHash +previousTokenHash').exec();
  if (!record) return null;
  const user = await User.findById(record.user).select('-refreshTokens').exec();
  if (!user || user.status !== 'active') {
    await AuthSession.updateOne({ _id: record._id, revokedAt: null }, { $set: { revokedAt: now, revokedReason: 'account_unavailable' } }).exec();
    return null;
  }
  return { record, user, token, tokenHash: hashToken(token) };
}

async function markSessionUsed(auth, now) {
  const lastUsedAt = new Date(auth.record.lastUsedAt || 0).getTime();
  // Activity timestamps are useful for device management, but writing on
  // every API call would turn a read-heavy dashboard into a write workload.
  if (lastUsedAt && now.getTime() - lastUsedAt < 60_000) return;
  await AuthSession.updateOne({ _id: auth.record._id, revokedAt: null }, { $set: { lastUsedAt: now } }).exec();
}

export async function resolveSessionToken(token, { renew = false, req, res } = {}) {
  const auth = await loadRawSession(token);
  if (!auth) return null;
  if (!renew) {
    await markSessionUsed(auth, nowDate());
    return auth;
  }
  return touchServerSession(auth, req, res);
}

async function touchServerSession(auth, req, res, { forceRotate = false } = {}) {
  const now = nowDate();
  const rollingDue = new Date(auth.record.expiresAt).getTime() - now.getTime() <= SESSION_RENEWAL_WINDOW_MS;
  if (!forceRotate && !rollingDue) {
    await markSessionUsed(auth, now);
    setCsrfCookie(req, res);
    return auth;
  }

  const nextToken = randomSessionToken();
  const nextTokenHash = hashToken(nextToken);
  const nextExpiry = new Date(Math.min(now.getTime() + SESSION_ROLLING_MS, new Date(auth.record.absoluteExpiresAt).getTime()));
  if (nextExpiry <= now) {
    await AuthSession.updateOne({ _id: auth.record._id, revokedAt: null }, { $set: { revokedAt: now, revokedReason: 'absolute_expiry' } }).exec();
    return null;
  }

  // An update pipeline copies the database's current token hash into the
  // grace slot atomically. This prevents two active tabs from invalidating
  // each other's just-issued token during a simultaneous renewal.
  const updated = await AuthSession.findOneAndUpdate(
    // Only the current digest may win a rotation. A previous digest is
    // accepted for grace-period request completion, but rotating from it
    // would let two simultaneous tabs advance the cookie twice and could
    // make the first response overwrite the newest browser cookie.
    { _id: auth.record._id, ...activeSessionFilter(now), tokenHash: auth.tokenHash },
    [{ $set: {
      tokenHash: nextTokenHash,
      previousTokenHash: '$tokenHash',
      previousTokenExpiresAt: new Date(now.getTime() + ROTATION_GRACE_MS),
      expiresAt: nextExpiry,
      lastUsedAt: now,
      lastRenewedAt: now,
      rotation: { $add: ['$rotation', 1] },
    } }],
    { new: true },
  ).select('+tokenHash +previousTokenHash').exec();

  if (!updated) {
    // Another request won the rotation race. The old token remains accepted
    // for the short grace period; it is safer to complete this request than
    // to turn a normal multi-tab race into a forced sign-out.
    await markSessionUsed(auth, now);
    setCsrfCookie(req, res);
    return auth;
  }
  setSessionCookie(req, res, nextToken, updated.expiresAt);
  return { ...auth, record: updated, token: nextToken, tokenHash: nextTokenHash };
}

export async function resolveServerSession(req, res, { renew = true, allowLegacy = true, forceRotate = false } = {}) {
  const token = req?.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    const auth = await loadRawSession(token);
    if (auth) {
      const touched = renew ? await touchServerSession(auth, req, res, { forceRotate }) : auth;
      if (touched) return touched;
    }
    // Do not leave an invalid cookie in the browser while trying a legacy
    // migration or when an administrator has revoked the current session.
    clearSessionCookies(res);
  }
  if (!allowLegacy || !req?.cookies?.[LEGACY_REFRESH_COOKIE_NAME]) return null;
  return migrateLegacyRefreshSession(req, res);
}

async function createSessionRecord(user, req, res, { sessionId = crypto.randomUUID(), updateLastLogin = true } = {}) {
  const now = nowDate();
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
  const expiresAt = new Date(Math.min(now.getTime() + SESSION_ROLLING_MS, absoluteExpiresAt.getTime()));
  const token = randomSessionToken();
  const record = await AuthSession.create({
    sessionId,
    user: user._id,
    tokenHash: hashToken(token),
    createdAt: now,
    lastUsedAt: now,
    lastRenewedAt: now,
    expiresAt,
    absoluteExpiresAt,
    device: requestDevice(req),
    ip: requestIp(req),
  });
  if (updateLastLogin) {
    user.lastLogin = now;
    await user.save({ validateModifiedOnly: true });
  }
  setSessionCookie(req, res, token, expiresAt);
  return { record, token };
}

export async function issueServerSession(user, req, res, options = {}) {
  const { record } = await createSessionRecord(user, req, res, options);
  return authSessionResponse(record, user);
}

async function migrateLegacyRefreshSession(req, res) {
  const legacyToken = req.cookies?.[LEGACY_REFRESH_COOKIE_NAME];
  let payload;
  try { payload = verifyRefreshToken(legacyToken); } catch {
    clearSessionCookies(res);
    return null;
  }
  const user = await User.findById(payload.sub).select('+refreshTokens').exec();
  const digest = hashToken(legacyToken);
  const stored = user?.refreshTokens?.find((item) => item.tokenHash === digest && item.expiresAt > nowDate() && (!payload.sid || item.sessionId === payload.sid));
  if (!user || user.status !== 'active' || !stored) {
    clearSessionCookies(res);
    return null;
  }
  const sessionId = payload.sid || stored.sessionId || crypto.randomUUID();
  const existing = await AuthSession.exists({ sessionId });
  const created = await createSessionRecord(user, req, res, { sessionId: existing ? crypto.randomUUID() : sessionId, updateLastLogin: false });
  user.refreshTokens = user.refreshTokens.filter((item) => item.tokenHash !== digest);
  await user.save({ validateModifiedOnly: true });
  res.clearCookie(LEGACY_REFRESH_COOKIE_NAME, { ...cookieBase(true), path: '/api/v1/auth' });
  return { record: created.record, user, token: created.token, tokenHash: hashToken(created.token) };
}

export function currentSessionId(req) {
  if (req?.session?.record?.sessionId) return req.session.record.sessionId;
  if (req?.session?.sessionId) return req.session.sessionId;
  const legacy = req?.cookies?.[LEGACY_REFRESH_COOKIE_NAME];
  if (!legacy) return null;
  try { return verifyRefreshToken(legacy).sid || null; } catch { return null; }
}

export async function renewServerSession(req, res) {
  const auth = await resolveServerSession(req, res, { renew: true, allowLegacy: true, forceRotate: false });
  if (!auth) return null;
  return authSessionResponse(auth.record, auth.user);
}

export async function revokeServerSession(req, res) {
  const token = req?.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    await AuthSession.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { $set: { revokedAt: nowDate(), revokedReason: 'logout' } }).exec();
  }
  const legacy = req?.cookies?.[LEGACY_REFRESH_COOKIE_NAME];
  if (legacy) {
    try {
      const payload = verifyRefreshToken(legacy);
      const user = await User.findById(payload.sub).select('+refreshTokens').exec();
      if (user) {
        user.refreshTokens = user.refreshTokens.filter((item) => item.tokenHash !== hashToken(legacy));
        await user.save({ validateModifiedOnly: true });
      }
    } catch { /* Invalid cookies are still cleared. */ }
  }
  clearSessionCookies(res);
}

export async function revokeSessionForUser(userId, sessionId, reason = 'revoked') {
  const result = await AuthSession.updateOne({ user: userId, sessionId, revokedAt: null }, { $set: { revokedAt: nowDate(), revokedReason: reason } }).exec();
  const user = await User.findById(userId).select('+refreshTokens').exec();
  let legacyRemoved = false;
  if (user) {
    const before = user.refreshTokens?.length || 0;
    user.refreshTokens = (user.refreshTokens || []).filter((item) => item.sessionId !== sessionId);
    legacyRemoved = user.refreshTokens.length !== before;
    if (legacyRemoved) await user.save({ validateModifiedOnly: true });
  }
  return result.modifiedCount > 0 || legacyRemoved;
}

export async function revokeOtherServerSessions(userId, currentId, reason = 'other_sessions_revoked') {
  await AuthSession.updateMany({ user: userId, ...(currentId ? { sessionId: { $ne: currentId } } : {}), revokedAt: null }, { $set: { revokedAt: nowDate(), revokedReason: reason } }).exec();
  const user = await User.findById(userId).select('+refreshTokens').exec();
  if (user) {
    user.refreshTokens = (user.refreshTokens || []).filter((item) => item.sessionId === currentId);
    await user.save({ validateModifiedOnly: true });
  }
}

export async function revokeAllServerSessions(userId, reason = 'all_sessions_revoked') {
  await AuthSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: nowDate(), revokedReason: reason } }).exec();
  await User.updateOne({ _id: userId }, { $set: { refreshTokens: [] } }).exec();
}

export async function listServerSessions(userId, currentId = null) {
  const records = await AuthSession.find({ user: userId, ...activeSessionFilter() }).sort({ lastUsedAt: -1, createdAt: -1 }).lean().exec();
  const sessions = records.map((record) => ({
    id: record.sessionId,
    device: record.device || 'Unknown device',
    ip: record.ip || '',
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    expiresAt: record.expiresAt,
    absoluteExpiresAt: record.absoluteExpiresAt,
    current: record.sessionId === currentId,
    persistent: true,
  }));
  // Old v97 refresh records remain visible until each browser migrates. This
  // avoids making an active device disappear from its security screen.
  const user = await User.findById(userId).select('+refreshTokens').lean().exec();
  const known = new Set(sessions.map((session) => session.id));
  for (const item of (user?.refreshTokens || [])) {
    if (item.expiresAt <= nowDate() || known.has(item.sessionId)) continue;
    sessions.push({
      id: item.sessionId,
      device: item.device || 'Legacy browser session',
      ip: item.ip || '',
      createdAt: item.createdAt,
      lastUsedAt: item.lastUsedAt,
      expiresAt: item.expiresAt,
      current: item.sessionId === currentId,
      persistent: false,
    });
  }
  return sessions.sort((a, b) => new Date(b.lastUsedAt || b.createdAt).getTime() - new Date(a.lastUsedAt || a.createdAt).getTime());
}

export async function isServerSessionActive(sessionId) {
  if (!sessionId) return false;
  return Boolean(await AuthSession.exists({ sessionId, ...activeSessionFilter() }));
}

export async function ensureServerSessionIndexes() {
  await AuthSession.createIndexes();
}

export function sessionBootstrap(auth) {
  if (!auth?.user || !auth?.record) return { authenticated: false, user: null };
  return { authenticated: true, user: safeUser(auth.user), ...sessionInfo(auth.record) };
}
