import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('application agreement selector keeps paper and template management actions at dropdown bottom', () => {
  const panel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
  assert.match(panel, /data-secureasset-agreement-paper-dropdown="premium-footer-actions-v233"/);
  assert.match(panel, /value="__contract__"/);
  assert.match(panel, />Contract</);
  assert.match(panel, /value="__manage_templates__"/);
  assert.match(panel, />Templates</);
  assert.doesNotMatch(panel, />Manage Papers<\/Button>/);
});

test('paper agreement footer action opens selected template preview', () => {
  const panel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
  const page = read('src/app/pages/app/AgreementTemplatesPage.tsx');
  assert.match(panel, /agreement-templates\?preview=/);
  assert.match(page, /useSearchParams/);
  assert.match(page, /searchParams\.get\('preview'\)/);
  assert.match(page, /setPreviewing\(match\)/);
});
