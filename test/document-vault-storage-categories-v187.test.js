import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vault = readFileSync(new URL('../src/app/pages/app/DocumentVaultPage.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../server/src/services/driveService.js', import.meta.url), 'utf8');

test('v187 removes the VR quick-access surface and adds Land Patta to protected storage', () => {
  for (const token of ['PAN Card', 'Birth Certificate', 'Indian Passport', 'Voter ID', 'Aadhaar Card', 'Driving Licence', 'Vehicle Registration Certificate', 'Land Patta']) {
    assert.match(vault, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(service, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const token of ['Smart Vault · VR quick access', 'sa-vault-smart-stage', 'Enter VR view', 'WebXR ready']) {
    assert.doesNotMatch(vault, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(vault, /DocumentVaultWorkspace/);
  assert.match(service, /smart-property-land-records/);
  assert.match(service, /smart-property-land-records-land-patta/);
});
