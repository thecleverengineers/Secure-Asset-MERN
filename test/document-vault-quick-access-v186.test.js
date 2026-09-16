import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vault = readFileSync(new URL('../src/app/pages/app/DocumentVaultPage.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');
const service = readFileSync(new URL('../server/src/services/driveService.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../server/src/controllers/driveController.js', import.meta.url), 'utf8');

test('v187 exposes the seven requested document categories in the exact order', () => {
  const names = ['PAN Card', 'Birth Certificate', 'Indian Passport', 'Voter ID', 'Aadhaar Card', 'Driving Licence', 'Land Patta'];
  assert.match(vault, /STORAGE_DOCUMENT_CATEGORIES/);
  assert.match(service, /SMART_DOCUMENT_PINNED_QUICK_ACCESS/);
  assert.match(controller, /quickAccessDocuments/);
  let previous = -1;
  for (const name of names) {
    const position = vault.indexOf(`label: '${name}'`);
    assert.ok(position > previous, `${name} should remain in the requested order`);
    previous = position;
    assert.match(service, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(service, /smart-property-land-records/);
  assert.match(vault, /data-secureasset-document-vault-storage-documents="pan-birth-passport-voter-aadhaar-driving-land-patta-v187"/);
});

test('v187 makes each storage category keyboard accessible and responsive', () => {
  for (const token of ['action: \'smart-folder\'', 'role="button"', 'tabIndex={0}', 'openStorageDocument', 'sa-vault-mobile-category-tile', 'is-smart-folder']) {
    assert.match(vault, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const token of ['grid-template-columns: repeat(4', '.sa-vault-mobile-category-tile.is-smart-folder', '.sa-vault-mobile-category-icon.is-land-patta']) {
    assert.match(styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('v187 keeps storage categories backed by the existing protected Drive folders', () => {
  assert.match(service, /childByKey\.get\(shortcut\.key\)/);
  assert.match(service, /fileCount: countById\.get/);
  assert.match(controller, /serializeSmartDocumentShortcut/);
  assert.match(controller, /quickAccessDocuments: smartGroups\.flatMap/);
  assert.match(vault, /serverByKey\.get\(definition\.systemKey\)/);
  assert.match(vault, /storageDocumentFolders/);
});

test('v188 removes legacy download, zip and apk storage tiles', () => {
  assert.doesNotMatch(vault, /label: '(Download|Zip File|Apk)'/);
  assert.match(vault, /gridTemplateColumns: \{ xs:/);
  assert.match(vault, /md: 'repeat\(4,minmax\(0,1fr\)\)'/);
  assert.match(vault, />Share<\/Button>/);
  assert.match(vault, /data-secureasset-document-vault-recent-action="preview"/);
  assert.match(vault, /data-secureasset-document-vault-recent-action="delete"/);
});

test('v189 opens the selected storage folder instead of rendering global recent files', () => {
  assert.match(vault, /const selectedStorageDocument = useMemo\(\(\) => storageDocumentFolders\.find/);
  assert.match(vault, /const source = selectedStorageDocument \|\| mobileCategory \? filtered/);
  assert.match(vault, /data-secureasset-document-vault-folder-only/);
  assert.match(vault, /storage-folder-\$\{selectedStorageDocument\.key\}-v189/);
  assert.match(vault, /selectedStorageDocument \? <Button/);
  assert.match(vault, />Back<\/Button>/);
});

test('v190 gives recent and folder cards full thumbnails with direct original sharing, rename and reliable delete', () => {
  assert.match(vault, /VaultRecentThumbnail item=\{item\} full/);
  assert.match(vault, /sa-vault-card-share-button/);
  assert.match(vault, /direct-original-file-v197/);
  assert.match(vault, /navigator\.share/);
  assert.match(vault, /allowDownload/);
  assert.doesNotMatch(vault, /window\.open\(target/);
  assert.match(vault, /data-secureasset-document-vault-recent-action="rename"/);
  assert.match(vault, /if \(action === 'rename'\)/);
  assert.match(vault, /if \(action === 'trash'\)/);
  assert.match(vault, /item\.itemType \? item : \{ \.\.\.item, itemType: 'file'/);
  assert.match(styles, /\.sa-vault-recent-card-media/);
  assert.match(styles, /\.sa-vault-share-channel\.is-whatsapp/);
});
