import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildFast2SmsSettingsUpdate, buildFast2SmsUrl, decryptIntegrationSecret, encryptIntegrationSecret,
  normalizeIndianMobile, renderVariableValues,
} from '../server/src/services/fast2sms.js';
import { IntegrationSetting, User } from '../server/src/models/index.js';

test('Indian mobile numbers normalize consistently for login and OTP delivery', () => {
  assert.equal(normalizeIndianMobile('9707949651'), '9707949651');
  assert.equal(normalizeIndianMobile('+91 97079 49651'), '9707949651');
  assert.equal(normalizeIndianMobile('09707949651'), '9707949651');
  assert.equal(normalizeIndianMobile('12345'), null);
});

test('Fast2SMS DLT URL includes the configured OTP variable and recipient', () => {
  const url = buildFast2SmsUrl({
    endpoint: 'https://www.fast2sms.com/dev/bulkV2', authorization: 'secret-key', route: 'dlt',
    senderId: 'SECAST', messageId: '204251', variablesTemplate: '{otp}|{name}', scheduleTime: '',
  }, { mobile: '9707949651', otp: '654321', name: 'Clever Engineers' });
  assert.equal(url.origin + url.pathname, 'https://www.fast2sms.com/dev/bulkV2');
  assert.equal(url.searchParams.get('authorization'), 'secret-key');
  assert.equal(url.searchParams.get('route'), 'dlt');
  assert.equal(url.searchParams.get('sender_id'), 'SECAST');
  assert.equal(url.searchParams.get('message'), '204251');
  assert.equal(url.searchParams.get('variables_values'), '654321|Clever Engineers');
  assert.equal(url.searchParams.get('numbers'), '9707949651');
  assert.equal(renderVariableValues('{otp}', { otp: '111222' }), '111222');
});

test('Fast2SMS authorization credentials encrypt at rest', () => {
  const encrypted = encryptIntegrationSecret('218M-real-secret');
  assert.notEqual(encrypted, '218M-real-secret');
  assert.match(encrypted, /^v2\.[^.]+\.[^.]+\.[^.]+$/);
  assert.equal(decryptIntegrationSecret(encrypted), '218M-real-secret');
  const path = IntegrationSetting.schema.path('secureConfig.authorizationEncrypted');
  assert.equal(path.options.select, false);
});

test('encrypted provider credentials remain readable when JWT signing keys rotate', () => {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  const master = Buffer.alloc(32, 7).toString('base64');
  const script = (action, payload = '') => `
    import { encryptAuthenticatedSecret, decryptAuthenticatedSecret } from './server/src/utils/encryptedSecrets.js';
    const result = ${action}(${payload});
    process.stdout.write(typeof result === 'string' ? result : JSON.stringify(result));
  `;
  const run = (action, payload, secrets) => spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script(action, payload)],
    {
      cwd: projectRoot,
      env: { ...process.env, NODE_ENV: 'test', ENCRYPTION_MASTER_KEY_BASE64: master, ...secrets },
      encoding: 'utf8',
    },
  );
  const encryptedRun = run('encryptAuthenticatedSecret', "'fast2sms-secret'", {
    JWT_ACCESS_SECRET: 'old-access-secret', JWT_REFRESH_SECRET: 'old-refresh-secret', VAULT_ENCRYPTION_KEY: 'old-vault-secret',
  });
  assert.equal(encryptedRun.status, 0, encryptedRun.stderr);
  const decryptedRun = run('decryptAuthenticatedSecret', JSON.stringify(encryptedRun.stdout), {
    JWT_ACCESS_SECRET: 'new-access-secret', JWT_REFRESH_SECRET: 'new-refresh-secret', VAULT_ENCRYPTION_KEY: 'new-vault-secret',
  });
  assert.equal(decryptedRun.status, 0, decryptedRun.stderr);
  assert.deepEqual(JSON.parse(decryptedRun.stdout), { value: 'fast2sms-secret', usedLegacyKey: false });
});


test('Fast2SMS settings upsert never writes the provider key through conflicting operators', () => {
  const update = buildFast2SmsSettingsUpdate({
    enabled: true,
    publicConfig: { endpoint: 'https://www.fast2sms.com/dev/bulkV2', route: 'dlt', senderId: 'SECAST', messageId: '204251' },
    authorization: 'replacement-secret',
    updatedBy: '507f1f77bcf86cd799439011',
  });
  assert.deepEqual(Object.keys(update), ['$set']);
  assert.equal(Object.hasOwn(update.$set, 'key'), false);
  assert.equal(Object.hasOwn(update, '$setOnInsert'), false);
  assert.ok(update.$set['secureConfig.authorizationEncrypted']);
  assert.equal(decryptIntegrationSecret(update.$set['secureConfig.authorizationEncrypted']), 'replacement-secret');
});

test('blank Fast2SMS authorization preserves the previously stored encrypted key', () => {
  const update = buildFast2SmsSettingsUpdate({
    enabled: false,
    publicConfig: { route: 'dlt' },
    authorization: '   ',
    updatedBy: '507f1f77bcf86cd799439011',
  });
  assert.equal(Object.hasOwn(update.$set, 'secureConfig.authorizationEncrypted'), false);
  assert.equal(update.$set.status, 'disabled');
});

test('user schema supports pending mobile verification and purpose-bound OTP records', () => {
  assert.ok(User.schema.path('status').enumValues.includes('pending_verification'));
  assert.deepEqual(User.schema.path('otpPurpose').enumValues, ['registration', 'login', 'password_reset']);
  assert.equal(User.schema.path('otpHash').options.select, false);
  assert.equal(User.schema.path('otpPurpose').options.select, false);
});

test('authentication routes expose registration verification and mobile OTP reset contracts', () => {
  const routes = fs.readFileSync(new URL('../server/src/routes/authRoutes.js', import.meta.url), 'utf8');
  const controller = fs.readFileSync(new URL('../server/src/controllers/authController.js', import.meta.url), 'utf8');
  assert.match(routes, /register\/verify/);
  assert.match(routes, /register\/resend-otp/);
  assert.match(controller, /password_reset/);
  assert.match(controller, /Invalid email\/mobile number or password/);
  assert.match(controller, /registered mobile/);
});
