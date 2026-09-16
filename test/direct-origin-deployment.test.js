import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('direct-origin deployment has no external cache or purge dependency', () => {
  const deploy = read('scripts/deploy-production.sh');
  const repair = read('scripts/repair-auth-routing.sh');
  const configure = read('scripts/configure-production-env.js');
  const envExample = read('.env.production.example');
  assert.match(deploy, /verify_direct_origin/);
  assert.match(repair, /verify_direct_origin/);
  assert.match(configure, /Removed legacy external-edge settings/);
  assert.doesNotMatch(deploy, /purge-cloudflare|CLOUDFLARE/i);
  assert.doesNotMatch(repair, /purge-cloudflare|CLOUDFLARE/i);
  assert.doesNotMatch(configure, /DEFAULT_CLOUDFLARE|CLOUDFLARE_PURGE/i);
  assert.doesNotMatch(envExample, /CLOUDFLARE/i);
});

test('direct-origin deployment verifies both PM2 loopback and local named-vhost assets', () => {
  const deploy = read('scripts/deploy-production.sh');
  assert.match(deploy, /http:\/\/127\.0\.0\.1:\$\{PORT\}/);
  assert.match(deploy, /--connect-host=127\.0\.0\.1 --insecure-tls/);
  assert.match(deploy, /reconcile-http-listener\.js --verify-pm2/);
  assert.match(deploy, /reconcile-pm2-release\.js --wait/);
});
