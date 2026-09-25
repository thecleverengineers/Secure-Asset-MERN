import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../src/styles/document-vault.css', import.meta.url), 'utf8');

test('reference cards keep themed surfaces and centered labels', () => {
  assert.match(styles, /--dv-paper: #fff/);
  assert.match(styles, /background: var\(--dv-paper\)/);
  assert.match(styles, /text-align: center/);
});
