import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('stale lazy chunks recover automatically with a cache-busting route reload', () => {
  const source = fs.readFileSync(new URL('../src/app/utils/lazyWithRetry.ts', import.meta.url), 'utf8');
  assert.match(source, /secureasset_chunk_reload_count/);
  assert.match(source, /MAX_CHUNK_RELOADS = 2/);
  assert.match(source, /window\.location\.replace\(url\.toString\(\)\)/);
});

test('the visible retry control also uses a cache-busting route reload', () => {
  const source = fs.readFileSync(new URL('../src/app/components/shared/RouteErrorPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /__secureasset_asset_refresh/);
  assert.match(source, /secureasset_chunk_reload_count/);
});
