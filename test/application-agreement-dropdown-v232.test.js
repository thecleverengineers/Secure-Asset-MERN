import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('application agreement setup keeps only selector and prepare action', () => {
  const panel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
  assert.match(panel, /data-secureasset-agreement-actions="selector-only-v235"/);
  assert.match(panel, /data-secureasset-agreement-paper-dropdown="templates-only-v235"/);
  assert.doesNotMatch(panel, />Contract<\/Typography>/);
  assert.doesNotMatch(panel, />Templates<\/Typography>/);
  assert.doesNotMatch(panel, /handleAgreementPaperSelection/);
});

test('renewal agreement no longer shows Contract or Templates actions', () => {
  const panel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
  assert.match(panel, /Prepare renewal/);
  assert.doesNotMatch(panel, /__contract__/);
  assert.doesNotMatch(panel, /__manage_templates__/);
});
