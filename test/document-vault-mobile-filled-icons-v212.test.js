import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../src/styles/document-vault.css', import.meta.url), 'utf8');

test('reference category icons remain circular with distinct category colours', () => {
  assert.match(styles, /border-radius: 50%/);
  assert.match(styles, /\.dv-icon-pan-card/);
  assert.match(styles, /\.dv-icon-vehicle-registration/);
  assert.match(styles, /\.dv-icon-land-patta/);
});
