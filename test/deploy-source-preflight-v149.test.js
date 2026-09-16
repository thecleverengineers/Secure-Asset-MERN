import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const deploy = readFileSync(new URL('../scripts/deploy-production.sh', import.meta.url), 'utf8');

test('deployment verifies source and TypeScript before database work', () => {
  const dependencyInstall = deploy.indexOf('step "Installing exact npm dependencies"');
  const sourcePreflight = deploy.indexOf('step "Validating application source before database changes"');
  const mongoCheck = deploy.indexOf('step "Checking MongoDB"');
  const migration = deploy.indexOf('step "Running the locked automatic database migration suite"');

  assert.ok(dependencyInstall >= 0 && sourcePreflight > dependencyInstall, 'source verification must run after dependencies are installed');
  assert.ok(mongoCheck > sourcePreflight, 'source verification must run before database checks');
  assert.ok(migration > sourcePreflight, 'source verification must run before migrations');
  assert.match(deploy, /step "Validating application source before database changes"[\s\S]*run_app npm run verify[\s\S]*run_app npm run audit:production/);
  assert.equal((deploy.match(/run_app npm run verify/g) || []).length, 1, 'the complete verification must have one early, authoritative execution');
});
