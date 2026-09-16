import crypto from 'node:crypto';
import { env } from '../config/env.js';

const MASTER_KEY_BYTES = 32;

function decodeMasterKey() {
  const encoded = String(env.ENCRYPTION_MASTER_KEY_BASE64 || '').trim();
  if (!encoded) return null;

  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64');
  } catch {
    throw new Error('ENCRYPTION_MASTER_KEY_BASE64 is not valid Base64');
  }
  if (decoded.length !== MASTER_KEY_BYTES) {
    throw new Error('ENCRYPTION_MASTER_KEY_BASE64 must decode to exactly 32 bytes');
  }
  return decoded;
}

function hashKey(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest();
}

function legacyKeys() {
  return [
    env.VAULT_ENCRYPTION_KEY,
    env.JWT_REFRESH_SECRET,
    env.JWT_ACCESS_SECRET,
  ].filter(Boolean).map(hashKey);
}

export function primaryEncryptionKey() {
  return decodeMasterKey() || legacyKeys()[0] || hashKey('secureasset-development-encryption-key');
}

export function encryptionKeyCandidates() {
  const keys = [primaryEncryptionKey(), ...legacyKeys()];
  const seen = new Set();
  return keys.filter((key) => {
    const fingerprint = key.toString('base64');
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

function decodePart(value, label) {
  const decoded = Buffer.from(String(value || ''), 'base64url');
  if (!decoded.length) throw new Error(`Encrypted secret ${label} is empty`);
  return decoded;
}

export function encryptAuthenticatedSecret(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', primaryEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // v2 makes the key contract explicit while the decryptor still accepts the
  // original three-part payload written by older SecureAsset releases.
  return `v2.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptAuthenticatedSecret(payload) {
  const parts = String(payload || '').split('.');
  if (parts.length === 4 && parts[0] === 'v2') parts.shift();
  if (parts.length !== 3) throw new Error('Stored encrypted secret has an invalid format');

  let lastError;
  for (const [index, key] of encryptionKeyCandidates().entries()) {
    try {
      const iv = decodePart(parts[0], 'initialisation vector');
      const tag = decodePart(parts[1], 'authentication tag');
      const encrypted = decodePart(parts[2], 'ciphertext');
      if (iv.length !== 12 || tag.length !== 16) throw new Error('Stored encrypted secret has invalid cryptographic metadata');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const value = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      return { value, usedLegacyKey: index > 0 };
    } catch (error) {
      lastError = error;
    }
  }

  const error = new Error('Stored encrypted secret could not be authenticated. Preserve ENCRYPTION_MASTER_KEY_BASE64 or save the integration credential again.');
  error.cause = lastError;
  throw error;
}

export function decryptAuthenticatedSecretValue(payload) {
  return decryptAuthenticatedSecret(payload).value;
}
