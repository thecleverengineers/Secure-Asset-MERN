import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v205 keeps Quick Access cards transparent while preserving round icon styling', () => {
  const vault = read('src/app/pages/app/DocumentVaultPage.tsx');
  const styles = read('src/styles/globals.css');

  assert.match(vault, /data-secureasset-document-vault-quick-access="transparent-cards-v205"/);
  assert.match(styles, /\.sa-vault-mobile-category-tile \{[^\n]*background: transparent !important;[^\n]*box-shadow: none !important;/);
  assert.match(styles, /\.sa-vault-mobile-category-tile\.is-smart-folder \{[^\n]*background: transparent !important;/);
  assert.match(styles, /\.sa-vault-mobile-category-icon \{[^\n]*border-radius: 50%/);
  assert.match(styles, /\.sa-vault-mobile-category-icon\.is-pan-card/);
  assert.match(styles, /\.sa-vault-mobile-category-icon\.is-land-patta/);
});
