import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const vault = readFileSync(new URL('../src/app/pages/app/DocumentVaultPage.tsx', import.meta.url), 'utf8') + readFileSync(new URL('../src/app/components/documents/DocumentVaultWorkspace.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/document-vault.css', import.meta.url), 'utf8');
const appShell = readFileSync(new URL('../src/app/components/layout/AppShell.tsx', import.meta.url), 'utf8');

test('reference design keeps compact category cards without a hero', () => {
  assert.doesNotMatch(vault, /sa-vault-mobile-storage-card/);
  assert.match(vault, /Quick Access/);
  assert.match(styles, /grid-template-columns: repeat\(4,minmax\(0,1fr\)\)/);
});

test('file cards load protected thumbnails and release their object URLs', () => {
  assert.match(vault, /function VaultRecentThumbnail/);
  assert.match(vault, /fetchDriveFileBlob\(item\._id\)/);
  assert.match(vault, /URL\.revokeObjectURL\(objectUrl\)/);
  assert.match(vault, /!vaultUnlocking && !vaultLocked && <DocumentVaultWorkspace/);
  assert.match(styles, /\.dv-file-grid \{ grid-template-columns: repeat\(2/);
  assert.match(vault, /Quick Share/);
});

test('the authenticated app header remains tied to the active theme navigation colours', () => {
  assert.match(appShell, /data-secureasset-app-header-theme="design-navigation-v160"/);
  assert.match(appShell, /bgcolor: design\.colors\.navigation/);
  assert.match(appShell, /color: design\.colors\.navigationText/);
});
