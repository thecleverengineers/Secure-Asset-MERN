import crypto from 'node:crypto';
import { ApiError } from '../utils/apiError.js';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../services/serverSession.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const LEGACY_BEARER_ALLOWED = /^Bearer\s+\S+$/i;
const PUBLIC_AUTH_PATHS = new Set([
  '/api/v1/auth/login', '/api/auth/login',
  '/api/v1/auth/register', '/api/auth/register',
  '/api/v1/auth/register/verify', '/api/auth/register/verify',
  '/api/v1/auth/register/resend-otp', '/api/auth/register/resend-otp',
  '/api/v1/auth/two-factor/challenge', '/api/auth/two-factor/challenge',
  '/api/v1/auth/send-otp', '/api/auth/send-otp',
  '/api/v1/auth/verify-otp', '/api/auth/verify-otp',
  '/api/v1/auth/forgot-password', '/api/auth/forgot-password',
  '/api/v1/auth/reset-password', '/api/auth/reset-password',
  '/api/v1/auth/refresh', '/api/auth/refresh',
]);

function timingSafeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method) || !req.path.startsWith('/api/')) return next();
  if (PUBLIC_AUTH_PATHS.has(req.path)) return next();
  // The bearer path is retained only for rolling upgrades. New sessions are
  // cookie-only and therefore always use the double-submit CSRF token.
  if (!req.cookies?.[SESSION_COOKIE_NAME] || LEGACY_BEARER_ALLOWED.test(req.get('authorization') || '')) return next();
  const expected = req.cookies?.[CSRF_COOKIE_NAME];
  const supplied = req.get('x-secureasset-csrf');
  if (!timingSafeEqual(expected, supplied)) return next(new ApiError(403, 'Secure request verification failed. Refresh the page and try again.'));
  return next();
}
