import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTwoFactorSecret, totpCode, verifyTotp, encryptTwoFactorSecret, decryptTwoFactorSecret, generateBackupCodes, hashBackupCode, consumeBackupCode } from '../server/src/services/twoFactor.js';
import { User } from '../server/src/models/index.js';

test('TOTP secrets encrypt, decrypt and validate current codes', () => {
  const secret = generateTwoFactorSecret();
  assert.ok(secret.length >= 20);
  assert.equal(decryptTwoFactorSecret(encryptTwoFactorSecret(secret)), secret);
  const code = totpCode(secret, Date.now());
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotp(secret, code, { now: Date.now(), window: 0 }), true);
  assert.equal(verifyTotp(secret, '000000', { now: Date.now(), window: 0 }), code === '000000');
});

test('backup codes are single-use and stored as hashes', () => {
  const [code] = generateBackupCodes(3);
  const hashes = [hashBackupCode(code), hashBackupCode('OTHER-CODE')];
  const result = consumeBackupCode(hashes, code);
  assert.equal(result.valid, true);
  assert.equal(result.remaining.length, 1);
  assert.equal(consumeBackupCode(result.remaining, code).valid, false);
});

test('user session schema requires stable session identifiers', () => {
  const user = new User({ name: 'Security Test', email: 'security-test@example.com', password: 'StrongPass123', refreshTokens: [{ tokenHash: 'hash', expiresAt: new Date(Date.now() + 10000) }] });
  const error = user.validateSync();
  assert.ok(error?.errors?.['refreshTokens.0.sessionId']);
});
