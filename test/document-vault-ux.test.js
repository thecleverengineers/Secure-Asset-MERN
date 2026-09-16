import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vault = readFileSync(new URL('../src/app/pages/app/DocumentVaultPage.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');
const vaultRoutes = readFileSync(new URL('../server/src/routes/driveRoutes.js', import.meta.url), 'utf8');
const vaultSecurity = readFileSync(new URL('../server/src/middleware/vaultSecurity.js', import.meta.url), 'utf8');
const fileResponse = readFileSync(new URL('../server/src/utils/httpFile.js', import.meta.url), 'utf8');
const driveController = readFileSync(new URL('../server/src/controllers/driveController.js', import.meta.url), 'utf8');

test('Document Vault keeps its secure unlock and file workflows without the desktop hero panel', () => {
  assert.match(vault, /vaultUnlocking/);
  assert.match(vault, /sa-vault-unlock-overlay/);
  assert.match(vault, /aria-label="Unlocking secure document vault"/);
  assert.match(vault, /Identity verified/);
  assert.match(vault, /Access scope checked/);
  assert.match(vault, /data-secureasset-document-vault-toolbar="compact-v151"/);
  assert.match(vault, /Private document workspace/);
  assert.doesNotMatch(vault, /sa-vault-security-console/);
  assert.match(vault, /private by default/i);
  assert.match(vault, /uploadDriveFile/);
  assert.match(vault, /shareDriveItem/);
  assert.match(vault, /uploadDriveVersion/);
});

test('Document Vault security visuals include animated lock, scanline, progress and responsive styling', () => {
  for (const token of [
    '.sa-vault-unlock-overlay',
    '.sa-vault-unlock-ring-one',
    '.sa-vault-lock-closed',
    '.sa-vault-lock-open',
    '.sa-vault-unlock-progress-bar',
    '.sa-vault-unlock-scanline',
    '@keyframes sa-vault-lock-open',
    '@keyframes sa-vault-progress',
    '@media (max-width: 899px)',
  ]) assert.match(globalStyles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Document Vault mobile and tablet surface uses compact category cards and thumbnail-led recent files', () => {
  for (const token of [
    'Quick Access',
    'sa-vault-mobile-category-grid',
    'sa-vault-mobile-recent-list',
    'Recent files',
    'chooseMobileCategory',
    'CloudRounded',
    'VaultRecentThumbnail',
    'fetchDriveFileBlob',
  ]) assert.match(vault, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(vault, /data-secureasset-document-vault-storage-categories="four-icon-cards-v160"/);
  assert.match(vault, /data-secureasset-document-vault-recent-files="thumbnail-list-v160"/);
  assert.doesNotMatch(vault, /sa-vault-mobile-storage-card/);
  assert.doesNotMatch(vault, /sa-vault-mobile-bottom-nav/);
  assert.match(globalStyles, /@media \(max-width: 1199px\)/);
  assert.match(globalStyles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(globalStyles, /\.sa-vault-mobile-category-tile \{[^}]*flex-direction: column/);
  assert.match(globalStyles, /\.sa-vault-mobile-recent-thumbnail/);
  assert.match(globalStyles, /body:has\(\.sa-vault-mobile-shell\) \.sa-global-mobile-bottom-navigation/);
});

test('Document Vault keeps every authenticated response private and forces deliberate sharing', () => {
  assert.match(vaultRoutes, /router\.use\(authenticate, requireDeviceUnlock, vaultSecurityHeaders\)/);
  for (const header of ['Cache-Control', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Cross-Origin-Resource-Policy']) assert.match(vaultSecurity, new RegExp(`['"]${header}['"]`));
  assert.match(fileResponse, /Content-Disposition/);
  assert.match(fileResponse, /no-store, no-cache/);
  assert.match(driveController, /New vault files are private by default/);
  assert.match(driveController, /Uploads into public folders are disabled/);
});
