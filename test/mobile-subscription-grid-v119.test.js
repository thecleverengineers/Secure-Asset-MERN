import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('subscription cards render two per mobile row and four per desktop row', () => {
  const source = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
  assert.match(source, /<Grid size=\{\{ xs: 6, md: 3 \}\}/);
  assert.match(source, /spacing=\{\{ xs: 1\.5, md: 2 \}\}/);
});
