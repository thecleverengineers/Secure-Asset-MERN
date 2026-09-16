import crypto from 'node:crypto';
import { ApiError } from '../utils/apiError.js';

const PROTOTYPE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function unsafeKey(value, depth = 0) {
  if (depth > 24) return '[maximum nesting depth exceeded]';
  if (value === null || typeof value !== 'object' || Buffer.isBuffer(value) || value instanceof Date) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = unsafeKey(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.') || key.includes('\0') || PROTOTYPE_KEYS.has(key)) return key;
    const found = unsafeKey(child, depth + 1);
    if (found) return found;
  }
  return null;
}

export function requestContext(req, res, next) {
  const incoming = String(req.get('x-request-id') || '').trim();
  req.id = /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

export function rejectUnsafeObjectKeys(req, _res, next) {
  for (const [source, value] of [['body', req.body], ['query', req.query]]) {
    const found = unsafeKey(value);
    if (found) return next(new ApiError(400, `Unsafe request ${source} key: ${found}`));
  }
  return next();
}
