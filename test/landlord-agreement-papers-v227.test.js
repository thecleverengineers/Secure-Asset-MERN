import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('landlord agreement papers stay owner scoped for list and update', () => {
  const controller = read('server/src/controllers/agreementController.js');
  assert.match(controller, /const filter = \{ owner: req\.user\._id \}/);
  assert.match(controller, /AgreementTemplate\.findOne\(\{ _id: req\.params\.id, owner: req\.user\._id \}\)/);
  assert.match(controller, /owner: req\.user\._id, key, name, title, body/);
});

test('landlord sidebar exposes Agreement Papers and UI supports add/update', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const page = read('src/app/pages/app/AgreementTemplatesPage.tsx');
  assert.match(shell, /key: 'agreement-templates', label: 'Agreement Papers'/);
  assert.match(page, /Add Agreement Paper/);
  assert.match(page, /Update Agreement Paper/);
  assert.match(page, /Private to your landlord account/);
});
