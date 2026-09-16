import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('authentication primary actions reuse the configured application header color', () => {
  const source = readFileSync(new URL('../src/app/pages/LoginPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /const appHeaderColor = settings\.design\?\.colors\?\.navigation \|\| '#0B5270';/);
  assert.match(source, /bgcolor: appHeaderColor/);
  assert.match(source, /color: '#FFFFFF'/);
  assert.match(source, /disableElevation/);
  assert.match(source, /'&:hover': \{ bgcolor: appHeaderColor, filter: 'brightness\(\.9\)' \}/);
});
