import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('deployment tolerates an auth limiter response while preserving API-route checks', () => {
  const verifier = read('scripts/verify-auth-routing.js');
  assert.match(verifier, /response\.status === 429\) return/);
  assert.match(verifier, /\[404, 405, 502, 503, 504\]/);
});

test('production deployment builds immediately before PM2 and serves the direct origin', () => {
  const deploy = read('scripts/deploy-production.sh');
  assert.ok(deploy.indexOf('Finalizing the frontend build for the PM2 release') < deploy.indexOf('Starting or reloading PM2'));
  const vhost = read('scripts/reconcile-aapanel-vhost.js');
  assert.match(vhost, /proxy_cache off/);
  assert.match(vhost, /Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate"/);
  assert.match(deploy, /SECUREASSET_DIRECT_ORIGIN_CONTRACT="v175-direct-origin-only"/);
  assert.match(deploy, /verify_direct_origin/);
  assert.doesNotMatch(deploy, /PUBLIC_ORIGIN_RETRIES|ALLOW_STALE_PUBLIC_ORIGIN|purge-cloudflare|CLOUDFLARE/i);
  assert.doesNotMatch(vhost, /CDN-Cache-Control|Cloudflare-CDN-Cache-Control/);
  assert.doesNotMatch(read('server/src/middleware/spa.js'), /Cloudflare-CDN-Cache-Control/);
  assert.doesNotMatch(read('.env.production.example'), /CLOUDFLARE/i);
});
