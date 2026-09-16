import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('subscription pricing active tab uses white text over the primary indicator', () => {
  const source = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
  assert.match(source, /& \.MuiTab-root\.Mui-selected.*color: '#fff'/);
  assert.match(source, /'& \.MuiTabs-indicator'.*bgcolor: primary/);
});
