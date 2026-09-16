import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const audit = readFileSync(new URL('../scripts/audit-enterprise-features.js', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../src/app/routes.tsx', import.meta.url), 'utf8');

test('enterprise audit recognises the nested public reset-password route', () => {
  assert.match(routes, /path: 'reset-password', Component: ResetPasswordPage/);
  assert.match(audit, /Password reset has a dedicated route[\s\S]*ResetPasswordPage/);
  assert.match(audit, /\.test\(clientRoutes\)/);
  assert.doesNotMatch(audit, /routes\.tsx'\)\.includes\('\/reset-password'\)/);
});

test('enterprise audit passes against the production source tree', () => {
  const result = spawnSync(process.execPath, ['scripts/audit-enterprise-features.js'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Enterprise audit passed/);
});
