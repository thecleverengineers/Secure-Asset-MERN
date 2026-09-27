import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/app/pages/LoginPage.tsx', import.meta.url), 'utf8');

test('initial OTP actions use Continue labels', () => {
  assert.match(source, /mode === 'register'\) actionLabel = otpSent \? 'Verify mobile and create account' : 'Continue'/);
  assert.match(source, /mode === 'otp'\) actionLabel = otpSent \? 'Verify OTP' : 'Continue'/);
  assert.doesNotMatch(source, /'Send verification OTP'/);
  assert.doesNotMatch(source, /'Send OTP'/);
});
