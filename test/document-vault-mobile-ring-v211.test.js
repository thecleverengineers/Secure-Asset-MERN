import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../src/styles/document-vault.css', import.meta.url), 'utf8');

test('mobile category rings remain visible and keyboard focus has an outline', () => {
  assert.match(styles, /outline: 3px solid var\(--dv-paper\)/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /outline-offset: 3px/);
});
