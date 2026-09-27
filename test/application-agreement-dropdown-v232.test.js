import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('application agreement keeps Contract and Templates always visible below selector', () => {
  const panel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
  assert.match(panel, /data-secureasset-agreement-actions="always-visible-v234"/);
  assert.match(panel, /data-secureasset-agreement-paper-dropdown="templates-only-v234"/);
  assert.match(panel, /handleAgreementPaperSelection\('__contract__'\)/);
  assert.match(panel, /handleAgreementPaperSelection\('__manage_templates__'\)/);
  assert.match(panel, />Contract<\/Typography>/);
  assert.match(panel, />Templates<\/Typography>/);
  assert.doesNotMatch(panel, /<MenuItem[\s\S]{0,300}value="__contract__"/);
  assert.doesNotMatch(panel, /<MenuItem[\s\S]{0,300}value="__manage_templates__"/);
});

test('Contract action opens the selected agreement paper preview', () => {
  const panel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
  const page = read('src/app/pages/app/AgreementTemplatesPage.tsx');
  assert.match(panel, /agreement-templates\?preview=/);
  assert.match(page, /useSearchParams/);
  assert.match(page, /searchParams\.get\('preview'\)/);
  assert.match(page, /setPreviewing\(match\)/);
});
