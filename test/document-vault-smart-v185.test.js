import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vault = readFileSync(new URL('../src/app/pages/app/DocumentVaultPage.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');
const service = readFileSync(new URL('../server/src/services/driveService.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../server/src/controllers/driveController.js', import.meta.url), 'utf8');
const model = readFileSync(new URL('../server/src/models/drive.js', import.meta.url), 'utf8');

test('v185 provisions the six protected Indian document quick-access groups', () => {
  const groups = [
    'Primary National Identity & Financial Proofs',
    'Civil & Life Event Certificates',
    'Transport & Mobility',
    'Educational & Academic Credentials',
    'Standard Proofs of Address (PoA)',
    'Healthcare & Welfare Schemes',
  ];
  for (const group of groups) {
    assert.match(service, new RegExp(group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const child of ['Aadhaar Card', 'PAN Card', 'Voter ID', 'Indian Passport', 'Birth Certificate', 'Marriage Certificate', 'Death Certificate', 'Driving Licence', 'Vehicle Registration Certificate', '10th Class Passing Certificate', '12th Marksheet', 'Degree / Diploma Certificates', 'Utility Bills', 'Bank Passbook', 'Registered Rent Agreement', 'Ration Card', 'ABHA Card', 'UDID']) {
    assert.match(service, new RegExp(child.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(controller, /quickAccess/);
  assert.match(service, /ensureSmartDocumentFolders/);
  assert.match(service, /getSmartDocumentFolders/);
  assert.match(vault, /STORAGE_DOCUMENT_CATEGORIES/);
});

test('v185 protected taxonomy remains while the deprecated VR section is absent', () => {
  for (const token of ['SMART_DOCUMENT_FOLDERS', 'getSmartDocumentFolders', 'smartDocumentFolderDefaults', 'smartFolderKey']) {
    assert.match(`${vault}\n${service}\n${controller}`, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const token of ['Smart Vault · VR quick access', 'sa-vault-smart-stage', 'immersive-vr', 'WebXR ready', 'Enter VR view']) {
    assert.doesNotMatch(vault, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const token of ['sa-vault-smart-stage', 'sa-vault-smart-folder', 'sa-vault-smart-pinned']) {
    assert.doesNotMatch(styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('v185 keeps smart-folder uploads classified and protected by the server', () => {
  assert.match(model, /smartFolderKey: \{ type: String, index: true \}/);
  assert.match(model, /documentType: \{ type: String, trim: true, maxlength: 180 \}/);
  assert.match(controller, /smartDocumentFolderDefaults/);
  assert.match(controller, /smartFolderKey: smart\?\.smartFolderKey/);
  assert.match(controller, /metadata\.smartFolderKey = smart\.smartFolderKey/);
  assert.match(controller, /smartFolderKey: session\.metadata\?\.smartFolderKey/);
  assert.match(controller, /confidentiality: smart\?\.confidentiality/);
  assert.match(controller, /New vault files are private by default/);
  assert.match(service, /category: 'legal'/);
});

test('v197 shares the original file itself directly without generating a link or confirmation dialog', () => {
  assert.match(vault, /instantShare/);
  assert.match(vault, /data-secureasset-document-vault-sharing="direct-original-file-v197"/);
  assert.match(vault, /fetchDriveFileBlob\(item\._id, true\)/);
  assert.match(vault, /new File\(\[blob\], item\.name/);
  assert.match(vault, /files: \[file\]/);
  assert.match(vault, /navigator\.share/);
  const shareBody = vault.slice(vault.indexOf('async function instantShare'), vault.indexOf('async function createLink'));
  assert.doesNotMatch(shareBody, /createDrivePublicLink/);
  assert.doesNotMatch(shareBody, /url:/);
  assert.doesNotMatch(shareBody, /askConfirmation/);
});
