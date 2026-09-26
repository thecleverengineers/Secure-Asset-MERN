import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('security deposit approval is restricted to the receiving landlord, never admin', () => {
  const agreement = read('server/src/controllers/agreementController.js');
  assert.match(agreement, /function assertSecurityDepositLandlord/);
  assert.match(agreement, /role \|\| ''\)\.toLowerCase\(\) === 'admin'/);
  assert.match(agreement, /Only the receiving landlord can verify the security deposit and start the rent workflow/);
  assert.match(agreement, /assertSecurityDepositLandlord\(request, req\.user\)/);
});

test('generic payment administration cannot bypass landlord-only security deposit verification', () => {
  const resources = read('server/src/controllers/resourceController.js');
  const page = read('src/app/pages/app/ResourcePage.tsx');
  assert.match(resources, /function isAgreementSecurityDepositPayment/);
  assert.match(resources, /Security deposit verification is landlord-only/);
  assert.match(resources, /Security deposit status is landlord-only/);
  assert.match(resources, /Security deposit payment records are protected/);
  assert.match(page, /function isAgreementSecurityDepositPayment/);
  assert.match(page, /Landlord verification only/);
});
