import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../src/styles/document-vault.css', import.meta.url), 'utf8');

test('reference theme scopes light and dark colours to the vault', () => {
  assert.match(styles, /\.sa-document-vault-page\.sa-vault-premium/);
  assert.match(styles, /data-vault-theme="dark"/);
  assert.match(styles, /--dv-ink:/);
  assert.match(styles, /--dv-muted:/);
});
