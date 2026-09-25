import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vault = readFileSync(new URL('../src/app/pages/app/DocumentVaultPage.tsx', import.meta.url), 'utf8') + readFileSync(new URL('../src/app/components/documents/DocumentVaultWorkspace.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/document-vault.css', import.meta.url), 'utf8');
const service = readFileSync(new URL('../server/src/services/driveService.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../server/src/controllers/driveController.js', import.meta.url), 'utf8');

test('v187 exposes the eight reference document categories in the exact order', () => {
  const names = ['PAN Card', 'Birth Certificate', 'Indian Passport', 'Voter ID', 'Aadhaar Card', 'Driving Licence', 'Vehicle Registration Certificate', 'Land Patta'];
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

});

test('reference storage categories use native accessible buttons and responsive cards', () => {
  assert.match(vault, /<Button key=\{category.key\}/);
  assert.match(vault, /aria-label=\{`Open \$\{category.label\} files`\}/);
  assert.match(vault, /onClick=\{\(\) => onCategory\(category\)\}/);
  assert.match(styles, /grid-template-columns: repeat\(4,minmax\(0,1fr\)\)/);
});

test('v187 keeps storage categories backed by the existing protected Drive folders', () => {
  assert.match(service, /childByKey\.get\(shortcut\.key\)/);
  assert.match(service, /fileCount: countById\.get/);
  assert.match(controller, /serializeSmartDocumentShortcut/);
  assert.match(controller, /quickAccessDocuments: smartGroups\.flatMap/);
  assert.match(vault, /serverByKey\.get\(definition\.systemKey\)/);
  assert.match(vault, /storageDocumentFolders/);
});

test('reference vault exposes document previews and keeps file actions in the menu', () => {
  assert.doesNotMatch(vault, /label: '(Download|Zip File|Apk)'/);
  assert.match(vault, /VaultRecentThumbnail item=\{item\} full/);
  assert.match(vault, /aria-label=\{`Preview \$\{item.name\}`\}/);
  assert.match(vault, /aria-label=\{`Actions for \$\{item.name\}`\}/);
  assert.match(vault, /onMenu=\{\(anchor,\s*item\)\s*=>\s*setMenu/);
});

test('selected categories load their actual protected folder and clear stale searches', () => {
  assert.match(vault, /const targetFolder = document\._id/);
  assert.match(vault, /setSection\(targetSection\); setFolderId\(targetFolder\); setSearch\(''\)/);
  assert.match(vault, /await load\(targetSection, targetFolder\)/);
  assert.match(vault, /getDriveItems\(\{ folderId: resolvedFolder/);
  assert.match(vault, /items=\{allItems\}/);
});

test('file actions preserve original sharing, rename and reliable delete', () => {
  assert.match(vault, /navigator\.share/);
  assert.match(vault, /allowDownload/);
  assert.doesNotMatch(vault, /window\.open\(target/);
  for (const action of ['rename', 'trash', 'restore', 'download']) assert.ok(vault.includes(`if (action === '${action}')`));
  assert.match(vault, /files\.map\(\(x\) => \(\{ \.\.\.x, itemType: 'file'/);
  assert.match(vault, /Quick Share/);
  assert.match(vault, /removeVisibleDriveItem/);
});
