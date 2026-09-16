import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseListeningSocketInodes } from '../scripts/reconcile-http-listener.js';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('listener parser recognizes IPv4 and IPv6 TCP LISTEN socket inodes only for the requested port', () => {
  const tcp = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n   0: 0100007F:1388 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 12345\n   1: 0100007F:1770 00000000:0000 01 00000000:00000000 00:00000000 00000000     0        0 99999\n   2: 00000000000000000000000000000000:1388 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 67890\n`;
  assert.deepEqual([...parseListeningSocketInodes(tcp, 5000)].sort(), ['12345', '67890']);
  assert.deepEqual([...parseListeningSocketInodes(tcp, 6000)], []);
});

test('deploy and repair scripts clear and verify the HTTP listener around PM2 activation', () => {
  const deploy = fs.readFileSync(path.join(projectRoot, 'scripts', 'deploy-production.sh'), 'utf8');
  const repair = fs.readFileSync(path.join(projectRoot, 'scripts', 'repair-auth-routing.sh'), 'utf8');
  const pm2 = fs.readFileSync(path.join(projectRoot, 'scripts', 'reconcile-pm2-release.js'), 'utf8');
  const listener = fs.readFileSync(path.join(projectRoot, 'scripts', 'reconcile-http-listener.js'), 'utf8');
  const spa = fs.readFileSync(path.join(projectRoot, 'server', 'src', 'middleware', 'spa.js'), 'utf8');

  assert.ok(deploy.indexOf('reconcile-pm2-release.js --stop') < deploy.indexOf('reconcile-http-listener.js --clear'));
  assert.ok(deploy.indexOf('Stopping the previous SecureAsset processes') < deploy.indexOf('Starting or reloading PM2'));
  assert.ok(deploy.indexOf('reconcile-http-listener.js --clear') < deploy.indexOf('Starting or reloading PM2'));
  assert.ok(deploy.indexOf('reconcile-http-listener.js --verify-pm2') > deploy.indexOf('Starting or reloading PM2'));
  assert.match(deploy, /pm2 startOrReload "\$APP_DIR\/ecosystem\.config\.cjs" --env production --update-env/);
  assert.match(repair, /reconcile-http-listener\.js --clear/);
  assert.match(repair, /reconcile-http-listener\.js --verify-pm2/);
  assert.match(pm2, /--stop/);
  assert.match(pm2, /Stopping previous SecureAsset PM2 processes/);
  assert.match(listener, /Refusing to stop a non-SecureAsset process/);
  assert.match(listener, /Expected a process owned by \$\{appDir\}/);
  assert.match(listener, /process\.kill\(listener\.pid, 'SIGTERM'\)/);
  assert.match(listener, /Port \$\{port\} is not owned exclusively by the active PM2 SecureAsset process/);
  assert.match(spa, /Read it for each HTML navigation/);
  assert.match(spa, /fs\.readFileSync\(indexFile, 'utf8'\)/);
});
