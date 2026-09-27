import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('Fast2SMS registry contains approved security deposit WhatsApp templates', () => {
  const fast2sms = read('server/src/services/fast2sms.js');
  assert.match(fast2sms, /security_deposit_request: Object\.freeze\(\{/);
  assert.match(fast2sms, /messageId: '34218'/);
  assert.match(fast2sms, /security_deposit_completed: Object\.freeze\(\{/);
  assert.match(fast2sms, /messageId: '34219'/);
  assert.match(fast2sms, /phoneNumberId: '1202480702956271'/);
  assert.match(fast2sms, /template\.phoneNumberId \|\| config\.whatsappPhoneNumberId/);
});

test('agreement deposit workflow sends request and completion templates to tenant KYC WhatsApp', () => {
  const agreement = read('server/src/controllers/agreementController.js');
  assert.match(agreement, /TenantKyc\.findOne\(\{ user: tenantId \}\)/);
  assert.match(agreement, /sendSecurityDepositWhatsApp\(request, 'security_deposit_request'/);
  assert.match(agreement, /sendSecurityDepositWhatsApp\(request, 'security_deposit_completed'/);
  assert.match(agreement, /securityDepositPayment\.transactionId \|\| securityDepositPayment\.invoiceNumber/);
  assert.match(agreement, /publicAppLink\(/);
  assert.match(agreement, /dueDate,/);
});
