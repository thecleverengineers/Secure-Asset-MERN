import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('workspace search uses the premium shared header surface', () => {
  const search = read('src/app/components/layout/WorkspaceSearch.tsx');
  const shell = read('src/app/components/layout/AppShell.tsx');

  assert.match(shell, /import WorkspaceSearch from ['"]\.\/WorkspaceSearch['"]/);
  assert.match(shell, /<WorkspaceSearch value=\{globalQuery\}/);
  assert.doesNotMatch(shell, /<InputBase[^>]+value=\{globalQuery\}/);
  assert.match(search, /role="search"/);
  assert.match(search, /aria-keyshortcuts/);
  assert.match(search, /Ctrl K/);
  assert.match(search, /Clear search/);
  assert.match(search, /ArrowForwardRounded/);
});

test('workspace search preserves accessible submit and keyboard behavior', () => {
  const search = read('src/app/components/layout/WorkspaceSearch.tsx');
  assert.match(search, /canSubmit = value\.trim\(\)\.length >= 2/);
  assert.match(search, /type="submit"/);
  assert.match(search, /event\.key\.toLowerCase\(\) === 'k'/);
  assert.match(search, /event\.key === 'Escape'/);
  assert.match(search, /autoComplete: 'off'/);
});
