import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('authentication experience fills the available shell without container gutters', () => {
  const auth = read('src/app/components/auth/AuthExperience.tsx');

  assert.doesNotMatch(auth, /Container/);
  assert.match(auth, /width: '100%'/);
  assert.match(auth, /minHeight: \{ xs: 'calc\(100dvh - 132px\)', md: 'calc\(100dvh - 72px\)' \}/);
  assert.match(auth, /py: 0/);
  assert.match(auth, /px: 0/);
});

test('authentication surface is square, borderless and shadowless', () => {
  const auth = read('src/app/components/auth/AuthExperience.tsx');
  const styles = read('src/styles/globals.css');

  assert.match(auth, /className="sa-auth-surface"/);
  assert.match(auth, /borderRadius: 0/);
  assert.match(auth, /boxShadow: 'none'/);
  assert.match(styles, /\.sa-auth-surface\s*\{[\s\S]*border: 0 !important;[\s\S]*border-radius: 0 !important;[\s\S]*box-shadow: none !important;/);
});
