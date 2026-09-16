import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FAST2SMS_WHATSAPP_TEMPLATES,
  buildFast2SmsSettingsUpdate,
  buildFast2SmsWhatsAppUrl,
  normalizeFast2SmsWhatsAppVariables,
} from '../server/src/services/fast2sms.js';

test('all seven approved Fast2SMS WhatsApp templates are registered with the workbook IDs', () => {
  const expected = {
    payment_completed: ['26887', 1],
    secure_asset_kyc: ['26891', 1],
    property_listed_successfully: ['26892', 2],
    lease_agreement_ready: ['27054', 3],
    new_survey_assigned: ['27055', 4],
    confirming_successful_receipt_of_rent: ['27056', 3],
    rent_reminder: ['27057', 4],
  };
  assert.deepEqual(Object.keys(FAST2SMS_WHATSAPP_TEMPLATES).sort(), Object.keys(expected).sort());
  for (const [key, [messageId, variableCount]] of Object.entries(expected)) {
    assert.equal(FAST2SMS_WHATSAPP_TEMPLATES[key].messageId, messageId);
    assert.equal(FAST2SMS_WHATSAPP_TEMPLATES[key].variableCount, variableCount);
    assert.equal(FAST2SMS_WHATSAPP_TEMPLATES[key].variables.length, variableCount);
  }
});

test('Fast2SMS WhatsApp URL uses approved message ID, phone number ID and pipe variables', () => {
  const url = buildFast2SmsWhatsAppUrl({
    authorization: 'encrypted-provider-secret-after-decrypt',
    whatsappEndpoint: 'https://www.fast2sms.com/dev/whatsapp',
    whatsappPhoneNumberId: '1202480702956271',
  }, {
    mobile: '+91 97079 49651',
    templateKey: 'rent_reminder',
    variables: ['Rohan', '₹25,000', 'Modern House, Kohima', '14/08/2026, 09:00'],
  });
  assert.equal(url.origin + url.pathname, 'https://www.fast2sms.com/dev/whatsapp');
  assert.equal(url.searchParams.get('authorization'), 'encrypted-provider-secret-after-decrypt');
  assert.equal(url.searchParams.get('message_id'), '27057');
  assert.equal(url.searchParams.get('phone_number_id'), '1202480702956271');
  assert.equal(url.searchParams.get('numbers'), '9707949651');
  assert.equal(url.searchParams.get('variables_values'), 'Rohan|₹25,000|Modern House, Kohima|14/08/2026, 09:00');
});

test('WhatsApp variable counts are strict and settings keep OTP and WhatsApp switches independent', () => {
  assert.deepEqual(normalizeFast2SmsWhatsAppVariables('payment_completed', ['₹10,000']), ['₹10,000']);
  assert.throws(() => normalizeFast2SmsWhatsAppVariables('rent_reminder', ['Tenant']), /exactly 4/);
  const update = buildFast2SmsSettingsUpdate({ enabled: false, whatsappEnabled: true, publicConfig: {}, updatedBy: '507f1f77bcf86cd799439011' });
  assert.equal(update.$set.enabled, false);
  assert.equal(update.$set.status, 'configured');
  assert.equal(update.$set.publicConfig.whatsappEnabled, true);
  assert.equal(update.$set.publicConfig.otpEnabled, false);
});

test('domain event hooks reference every approved business template', () => {
  const files = [
    'server/src/controllers/authController.js',
    'server/src/controllers/resourceController.js',
    'server/src/services/rentalBilling.js',
    'server/src/services/paymentLifecycle.js',
    'server/src/services/whatsappNotifications.js',
  ].map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  for (const key of Object.keys(FAST2SMS_WHATSAPP_TEMPLATES)) assert.match(files, new RegExp(key));
});
