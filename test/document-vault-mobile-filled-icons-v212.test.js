import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v212 regression keeps mobile Quick Access icons filled circular', () => {
  const vault = read('src/app/pages/app/DocumentVaultPage.tsx');
  const styles = read('src/styles/globals.css');

  assert.match(vault, /data-secureasset-document-vault-quick-access-mobile="white-premium-cards-v213"/);
  assert.match(styles, /\.sa-vault-mobile-category-icon \{ width: 52px; height: 52px; border-radius: 50%; background: rgba\(255,255,255,\.42\) !important;/);
  assert.doesNotMatch(styles, /border: 2px solid currentColor;[\s\S]*background: transparent !important; box-shadow: 0 0 0 3px/);
});
