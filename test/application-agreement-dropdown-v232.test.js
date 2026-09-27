import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('application agreement setup keeps only selector and prepare action', () => {
  const panel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
  assert.match(panel, /data-secureasset-agreement-actions="responsive-prepare-v236"/);
  assert.match(panel, /data-secureasset-agreement-paper-dropdown="templates-only-v236"/);
  assert.match(panel, /data-secureasset-prepare-agreement="premium-responsive-v236"/);
  assert.doesNotMatch(panel, />Contract<\/Typography>/);
  assert.doesNotMatch(panel, />Templates<\/Typography>/);
});

test('prepare agreement layout wraps instead of overlapping', () => {
  const panel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
  assert.match(panel, /flexWrap="wrap"/);
  assert.match(panel, /flex: '1 1 245px'/);
  assert.match(panel, /flex: '1 1 170px'/);
  assert.match(panel, /textOverflow: 'ellipsis'/);
  assert.match(panel, /maxWidth: \{ xs: '100%', sm: 210 \}/);
});

test('renewal agreement keeps responsive non-overlapping controls', () => {
  const panel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
  assert.match(panel, /flex: '1 1 220px'/);
  assert.match(panel, /Prepare renewal/);
  assert.doesNotMatch(panel, /__contract__/);
  assert.doesNotMatch(panel, /__manage_templates__/);
});
