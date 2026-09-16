import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('home no longer exposes the database-connected feature heading', () => {
  const publicPages = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
  const defaults = readFileSync(new URL('../server/src/services/platformDefaults.js', import.meta.url), 'utf8');
  assert.doesNotMatch(publicPages, /Everything connected to the database/);
  assert.doesNotMatch(defaults, /Everything connected to the database/);
  assert.match(publicPages, /Core features/);
  assert.match(defaults, /title: 'Core features'/);
});
