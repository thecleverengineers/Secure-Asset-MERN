import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const jwtOptions = {
  algorithm: 'HS512',
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
};

export function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, type: 'access' }, env.JWT_ACCESS_SECRET, { ...jwtOptions, expiresIn: env.ACCESS_TOKEN_TTL, jwtid: crypto.randomUUID() });
}

export function signRefreshToken(user, sessionId = crypto.randomUUID()) {
  return jwt.sign({ sub: user._id.toString(), type: 'refresh', sid: sessionId }, env.JWT_REFRESH_SECRET, { ...jwtOptions, expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`, jwtid: crypto.randomUUID() });
}

export function signTwoFactorChallenge(user) {
  return jwt.sign({ sub: user._id.toString(), type: 'two_factor_challenge' }, env.JWT_ACCESS_SECRET, { ...jwtOptions, expiresIn: '5m', jwtid: crypto.randomUUID() });
}

export function verifyTwoFactorChallenge(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS512'], issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE });
  if (payload.type !== 'two_factor_challenge') throw new Error('Invalid challenge token type');
  return payload;
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS512'], issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE });
  if (payload.type !== 'access') throw new Error('Invalid token type');
  return payload;
}

export function signDeviceUnlockToken(user, credentialId) {
  return jwt.sign({ sub: user._id.toString(), type: 'device_unlock', cid: credentialId }, env.JWT_ACCESS_SECRET, { ...jwtOptions, expiresIn: '30m', jwtid: crypto.randomUUID() });
}

export function verifyDeviceUnlockToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS512'], issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE });
  if (payload.type !== 'device_unlock') throw new Error('Invalid device unlock token type');
  return payload;
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS512'], issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE });
  if (payload.type !== 'refresh') throw new Error('Invalid token type');
  return payload;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}
