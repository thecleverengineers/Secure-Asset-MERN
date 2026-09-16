import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const script = path.join(root, 'scripts/reconcile-aapanel-vhost.js');

function run(vhost, domain = 'secureasset.in', port = '5000') {
  return spawnSync(process.execPath, [script, vhost, domain, port], { cwd: root, encoding: 'utf8' });
}

function count(content, pattern) {
  return (content.match(pattern) ?? []).length;
}

test('aaPanel vhost reconciliation replaces conflicting API and asset locations in place', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secureasset-aapanel-v8-'));
  const vhost = path.join(dir, 'secureasset.in.conf');
  fs.writeFileSync(vhost, `server {\n  listen 80;\n  server_name secureasset.in;\n  return 301 https://$host$request_uri;\n}\nserver {\n  listen 443 ssl http2;\n  server_name secureasset.in www.secureasset.in;\n  root /www/secureasset/dist;\n  location /api/ { try_files $uri /index.html; }\n  location ^~ /assets/ { root /old/release; }\n  location / { try_files $uri $uri/ /index.html; }\n  include /www/server/panel/vhost/nginx/extension/secureasset.in/*.conf;\n}\n`);

  const result = run(vhost);
  assert.equal(result.status, 0, result.stderr);
  const content = fs.readFileSync(vhost, 'utf8');
  assert.equal(count(content, /location \^~ \/api\//g), 1);
  assert.equal(count(content, /location \^~ \/assets\//g), 1);
  assert.equal(count(content, /location \/api\//g), 0);
  assert.equal(count(content, /location \/ \{/g), 1);
  assert.match(content, /location \/ \{[\s\S]*?proxy_pass http:\/\/127\.0\.0\.1:5000;/);
  assert.match(content, /include \/www\/server\/panel\/vhost\/nginx\/extension\/secureasset\.in\/\*\.conf;/);
  assert.match(content, /proxy_pass http:\/\/127\.0\.0\.1:5000;/);
  assert.match(content, /BEGIN SecureAsset managed proxy locations/);
});

test('aaPanel vhost reconciliation is idempotent and preserves unrelated locations', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secureasset-aapanel-v8-'));
  const vhost = path.join(dir, 'secureasset.in.conf');
  fs.writeFileSync(vhost, `server {\n  listen 443 ssl;\n  server_name secureasset.in;\n  root /www/secureasset/dist;\n  location /custom-health { return 200 'ok'; }\n  location / { try_files $uri $uri/ /index.html; }\n}\n`);
  assert.equal(run(vhost).status, 0);
  const once = fs.readFileSync(vhost, 'utf8');
  assert.equal(run(vhost).status, 0);
  const twice = fs.readFileSync(vhost, 'utf8');
  assert.equal(twice, once);
  assert.equal(count(twice, /BEGIN SecureAsset managed proxy locations/g), 1);
  assert.equal(count(twice, /location \^~ \/api\//g), 1);
  assert.match(twice, /location \/custom-health/);
});

test('aaPanel vhost reconciliation updates an old SecureAsset managed block without duplicates', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secureasset-aapanel-v8-'));
  const vhost = path.join(dir, 'secureasset.in.conf');
  fs.writeFileSync(vhost, `server {\n  listen 443 ssl;\n  server_name secureasset.in;\n  location ^~ /api/ { proxy_pass http://127.0.0.1:4000; }\n  location /socket.io/ { proxy_pass http://127.0.0.1:4000; }\n  location ^~ /assets/ { proxy_pass http://127.0.0.1:4000; }\n  location = /index.html { proxy_pass http://127.0.0.1:4000; }\n  location ^~ /site-assets/ { proxy_pass http://127.0.0.1:4000; }\n  location ^~ /uploads/ { proxy_pass http://127.0.0.1:4000; }\n  location / { try_files $uri $uri/ /index.html; }\n}\n`);
  const result = run(vhost, 'secureasset.in', '5000');
  assert.equal(result.status, 0, result.stderr);
  const content = fs.readFileSync(vhost, 'utf8');
  assert.doesNotMatch(content, /127\.0\.0\.1:4000/);
  assert.equal(count(content, /proxy_pass http:\/\/127\.0\.0\.1:5000;/g), 7);
  assert.equal(count(content, /location \^~ \/api\//g), 1);
});
