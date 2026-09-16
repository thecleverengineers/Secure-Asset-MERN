import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { encryptionKeyCandidates, primaryEncryptionKey } from '../utils/encryptedSecrets.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buffer) {
  let bits = 0; let value = 0; let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value) {
  const normalized = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0; let current = 0; const bytes = [];
  for (const char of normalized) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Invalid Base32 secret');
    current = (current << 5) | index; bits += 5;
    if (bits >= 8) { bytes.push((current >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}

function secretKey() {
  return primaryEncryptionKey();
}

export function encryptTwoFactorSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from('2FA1'), iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function decryptTwoFactorSecret(payload) {
  const packed = Buffer.from(String(payload || ''), 'base64url');
  if (packed.length < 33 || packed.subarray(0, 4).toString() !== '2FA1') throw new Error('Invalid encrypted two-factor secret');
  const iv = packed.subarray(4, 16); const tag = packed.subarray(16, 32); const encrypted = packed.subarray(32);
  let lastError;
  for (const key of encryptionKeyCandidates()) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch (error) {
      lastError = error;
    }
  }
  const error = new Error('Stored two-factor secret could not be authenticated. Preserve ENCRYPTION_MASTER_KEY_BASE64 or reset two-factor authentication.');
  error.cause = lastError;
  throw error;
}

export function generateTwoFactorSecret() { return base32Encode(crypto.randomBytes(20)); }

export function totpCode(secret, at = Date.now()) {
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % (10 ** DIGITS)).padStart(DIGITS, '0');
}

export function verifyTotp(secret, code, { window = 1, now = Date.now() } = {}) {
  const normalized = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = totpCode(secret, now + offset * STEP_SECONDS * 1000);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) return true;
  }
  return false;
}

export function createOtpAuthUri({ secret, email, issuer = 'SecureAsset' }) {
  const label = `${issuer}:${email}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${encodeURIComponent(label)}?${params}`;
}

export function generateBackupCodes(count = 10) {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g).join('-'));
}

export function hashBackupCode(code) {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(String(code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()).digest('hex');
}

export function consumeBackupCode(hashes = [], code) {
  const target = hashBackupCode(code);
  const index = hashes.findIndex((value) => typeof value === 'string' && value.length === target.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(target)));
  if (index < 0) return { valid: false, remaining: hashes };
  return { valid: true, remaining: hashes.filter((_, itemIndex) => itemIndex !== index) };
}
