import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('deployment verifies the API process serves the current frontend before Nginx validation', () => {
  const source = fs.readFileSync(new URL('../scripts/deploy-production.sh', import.meta.url), 'utf8');
  const guard = source.indexOf('Synchronizing the active frontend release with PM2');
  const nginx = source.indexOf('Checking the configured Nginx virtual host locally');
  assert.ok(guard >= 0 && guard < nginx);
  assert.match(source.slice(guard, nginx), /verify-public-assets\.js "http:\/\/127\.0\.0\.1:\$\{PORT\}"/);
  assert.match(source.slice(guard, nginx), /pm2 restart secureasset --update-env/);
});
