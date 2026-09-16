import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v211 regression keeps mobile Quick Access cards and icon behavior covered', () => {
  const vault = read('src/app/pages/app/DocumentVaultPage.tsx');
  const styles = read('src/styles/globals.css');

  assert.match(vault, /data-secureasset-document-vault-quick-access-mobile="white-premium-cards-v213"/);
  assert.match(styles, /\.sa-vault-mobile-category-grid \.sa-vault-mobile-category-tile:nth-child\(n\) \{ background: #fff !important; border: 1px solid rgba\(42,62,92,\.10\) !important; border-radius: 15px !important;/);
  assert.doesNotMatch(styles, /border: 2px solid currentColor;[\s\S]*background: transparent !important; box-shadow: 0 0 0 3px/);
  assert.match(styles, /\.sa-vault-mobile-category-icon \{ width: 52px; height: 52px; border-radius: 50%; background: rgba\(255,255,255,\.42\) !important;/);
});
