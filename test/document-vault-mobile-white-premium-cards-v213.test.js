import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v213 gives mobile Quick Access premium white cards and centered titles', () => {
  const vault = read('src/app/pages/app/DocumentVaultPage.tsx');
  const styles = read('src/styles/globals.css');

  assert.match(vault, /data-secureasset-document-vault-quick-access-mobile="white-premium-cards-v213"/);
  assert.match(styles, /\.sa-vault-mobile-category-grid \.sa-vault-mobile-category-tile:nth-child\(n\) \{ background: #fff !important; border: 1px solid rgba\(42,62,92,\.10\) !important; border-radius: 15px !important;/);
  assert.match(styles, /\.sa-vault-mobile-category-icon \{ border: 0 !important; \}/);
  assert.match(styles, /\.sa-vault-mobile-category-tile > \.MuiTypography-root \{[\s\S]*font-weight: 800;[\s\S]*text-align: center;/);
});
