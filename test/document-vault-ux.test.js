import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vault = readFileSync(new URL('../src/app/pages/app/DocumentVaultPage.tsx', import.meta.url), 'utf8') + readFileSync(new URL('../src/app/components/documents/DocumentVaultWorkspace.tsx', import.meta.url), 'utf8');
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
  assert.match(vault, /Securely store, organize and access/);
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

test('Document Vault provides accessible search, file-type filters and scan/upload controls', () => {
  for (const label of ['Quick Access', 'Recent Files', 'Search documents and categories', 'Filter by file type', 'Grid view', 'List view', 'Scan document']) assert.ok(vault.includes(label));
  assert.match(vault, /onUpload=\{\(\)\s*=>\s*inputRef\.current\?\.click\(\)\}/);
  assert.match(vault, /onScan=\{\(\)\s*=>\s*scanRef\.current\?\.click\(\)\}/);
  assert.doesNotMatch(vault, /sa-vault-mobile-bottom-nav/);
});

test('Document Vault keeps every authenticated response private and forces deliberate sharing', () => {
  assert.match(vaultRoutes, /router\.use\(authenticate, requireDeviceUnlock, vaultSecurityHeaders\)/);
  for (const header of ['Cache-Control', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Cross-Origin-Resource-Policy']) assert.match(vaultSecurity, new RegExp(`['"]${header}['"]`));
  assert.match(fileResponse, /Content-Disposition/);
  assert.match(fileResponse, /no-store, no-cache/);
  assert.match(driveController, /New vault files are private by default/);
  assert.match(driveController, /Uploads into public folders are disabled/);
});
