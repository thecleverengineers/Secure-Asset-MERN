import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('authentication experience uses the premium contained SecureAsset frame', () => {
  const auth = read('src/app/components/auth/AuthExperience.tsx');
  const styles = read('src/styles/login-premium.css');

  assert.doesNotMatch(auth, /Container/);
  assert.match(auth, /className="sa-auth-experience sa-login-premium-shell"/);
  assert.match(auth, /className="sa-auth-surface sa-login-premium-surface"/);
  assert.match(auth, /className="sa-login-premium-grid"/);
  assert.match(styles, /\.sa-login-premium-wrap\s*\{[\s\S]*width: min\(1180px,100%\)/);
  assert.match(styles, /\.sa-auth-surface\.sa-login-premium-surface\s*\{[\s\S]*border-radius: 20px !important;[\s\S]*box-shadow: 0 18px 48px/);
});

test('authentication experience keeps a responsive mobile-first layout', () => {
  const auth = read('src/app/components/auth/AuthExperience.tsx');
  const styles = read('src/styles/login-premium.css');

  assert.match(auth, /className="sa-login-premium-brand"/);
  assert.match(auth, /className="sa-login-premium-form-column"/);
  assert.match(styles, /@media \(max-width: 959px\)/);
  assert.match(styles, /grid-template-columns: 1fr/);
  assert.match(styles, /@media \(max-width: 599px\)/);
  assert.match(styles, /border-radius: 0 !important/);
});
