import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const vault = readFileSync(new URL('../src/app/pages/app/DocumentVaultPage.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');
const appShell = readFileSync(new URL('../src/app/components/layout/AppShell.tsx', import.meta.url), 'utf8');

test('v160 removes the mobile documents hero and keeps four icon-over-title storage category cards', () => {
  assert.doesNotMatch(vault, /sa-vault-mobile-storage-card/);
  assert.match(vault, /data-secureasset-document-vault-storage-categories="four-icon-cards-v160"/);
  assert.match(styles, /\.sa-vault-mobile-category-grid \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.sa-vault-mobile-category-tile \{[^}]*flex-direction: column/);
  assert.match(styles, /\.sa-vault-mobile-category-icon/);
});

test('v160 recent files render safe authenticated thumbnails with a premium card treatment', () => {
  assert.match(vault, /function VaultRecentThumbnail/);
  assert.match(vault, /fetchDriveFileBlob\(item\._id\)/);
  assert.match(vault, /URL\.revokeObjectURL\(objectUrl\)/);
  assert.match(vault, /data-secureasset-document-vault-recent-files="thumbnail-list-v160"/);
  assert.match(styles, /\.sa-vault-mobile-recent-thumbnail \{[^}]*overflow: hidden/);
  assert.match(styles, /\.sa-vault-mobile-recent-card \{[^}]*border-radius: 14px !important/);
  assert.match(styles, /\.sa-vault-mobile-recent-grid \{[^}]*repeat\(2/);
  assert.match(vault, /data-secureasset-document-vault-recent-action="preview"/);
  assert.match(vault, /data-secureasset-document-vault-recent-action="delete"/);
  assert.match(vault, />Share<\/Box><\/MenuItem>/);
});

test('the authenticated app header remains tied to the active theme navigation colours', () => {
  assert.match(appShell, /data-secureasset-app-header-theme="design-navigation-v160"/);
  assert.match(appShell, /bgcolor: design\.colors\.navigation/);
  assert.match(appShell, /color: design\.colors\.navigationText/);
});
