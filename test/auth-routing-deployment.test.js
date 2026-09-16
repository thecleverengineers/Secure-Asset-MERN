import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function releasedLocalPort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function runVerifier(baseUrl, argumentsList = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/verify-auth-routing.js', baseUrl, ...argumentsList], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (value) => { stdout += value; });
    child.stderr.on('data', (value) => { stderr += value; });
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('authentication routing verifier accepts JSON API routes', async () => {
  await withServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/health/ready') return res.end(JSON.stringify({ success: true, service: 'secureasset-api' }));
    res.statusCode = 422;
    return res.end(JSON.stringify({ success: false, message: 'validation' }));
  }, async (baseUrl) => {
    const result = await runVerifier(baseUrl);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Authentication routing passed/);
  });
});

test('authentication routing verifier rejects SPA HTML returned for API calls', async () => {
  await withServer((req, res) => {
    if (req.url === '/api/health/ready') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, service: 'secureasset-api' }));
    }
    res.setHeader('Content-Type', 'text/html');
    return res.end('<html><div id="root"></div></html>');
  }, async (baseUrl) => {
    const result = await runVerifier(baseUrl);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /instead of API JSON/);
  });
});

test('authentication routing verifier can validate a named vhost through localhost', async () => {
  await withServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/health/ready') return res.end(JSON.stringify({ success: true, service: 'secureasset-api' }));
    res.statusCode = 422;
    return res.end(JSON.stringify({ success: false, message: 'validation' }));
  }, async (baseUrl) => {
    const vhostUrl = baseUrl.replace('127.0.0.1', 'secureasset.test');
    const result = await runVerifier(vhostUrl, ['--connect-host=127.0.0.1']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Authentication routing passed/);
  });
});

test('authentication routing verifier reports an unreachable network path separately', async () => {
  const port = await releasedLocalPort();
  const result = await runVerifier(`http://127.0.0.1:${port}`);
  assert.equal(result.code, 2, result.stderr);
  assert.match(result.stderr, /ECONNREFUSED|Authentication routing failed/);
});

test('authentication routing verifier treats an invalid configured URL as a hard failure', async () => {
  const result = await runVerifier('not-a-url');
  assert.equal(result.code, 1, result.stderr);
  assert.match(result.stderr, /Usage:/);
});

test('deployment repairs stale API bases and includes an aaPanel API proxy', () => {
  const configure = fs.readFileSync(path.join(root, 'scripts/configure-production-env.js'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'src/app/services/api.ts'), 'utf8');
  const proxy = fs.readFileSync(path.join(root, 'deploy/nginx/secureasset-aapanel-api.conf.template'), 'utf8');
  const deploy = fs.readFileSync(path.join(root, 'scripts/deploy-production.sh'), 'utf8');
  const repair = fs.readFileSync(path.join(root, 'scripts/repair-auth-routing.sh'), 'utf8');
  assert.match(configure, /set\('VITE_API_URL', process\.env\.VITE_API_URL \|\| '\/api\/v1', true\)/);
  assert.match(client, /production bundle must never send visitors to their own localhost/i);
  assert.match(proxy, /location \^~ \/api\//);
  assert.match(proxy, /proxy_pass http:\/\/127\.0\.0\.1:PORT/);
  assert.match(proxy, /location \^~ \/assets\//);
  assert.match(proxy, /X-SecureAsset-Proxy assets/);
  assert.match(proxy, /X-SecureAsset-Proxy app/);
  assert.match(deploy, /Checking the direct origin release/);
  assert.match(deploy, /verify-public-assets\.js/);
  assert.match(deploy, /SECUREASSET_DIRECT_ORIGIN_CONTRACT/);
  assert.match(deploy, /--connect-host=127\.0\.0\.1/);
  assert.match(repair, /\/www\/server\/nginx\/sbin\/nginx/);
  assert.match(repair, /reconcile-aapanel-vhost\.js/);
  assert.match(repair, /rm -f "\$LEGACY_TARGET"/);
  assert.match(repair, /previous vhost was restored/);
  assert.match(repair, /DIRECT_ORIGIN_REPAIR_CONTRACT/);
  assert.match(repair, /--connect-host=127\.0\.0\.1/);
});

function runAssetVerifier(baseUrl, argumentsList = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/verify-public-assets.js', baseUrl, ...argumentsList], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (value) => { stdout += value; });
    child.stderr.on('data', (value) => { stderr += value; });
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('public asset verifier accepts the current index and every built chunk', async () => {
  const indexHtml = fs.readFileSync(path.join(root, 'dist/index.html'));
  await withServer((req, res) => {
    if (req.url?.startsWith('/login')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(indexHtml);
    }
    if (req.url?.startsWith('/assets/')) {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      const name = decodeURIComponent(pathname.slice('/assets/'.length));
      const target = path.join(root, 'dist/assets', name);
      if (!fs.existsSync(target)) { res.statusCode = 404; return res.end('missing'); }
      res.setHeader('Content-Type', name.endsWith('.css') ? 'text/css' : 'application/javascript');
      return fs.createReadStream(target).pipe(res);
    }
    res.statusCode = 404;
    return res.end('missing');
  }, async (baseUrl) => {
    const result = await runAssetVerifier(baseUrl);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Public frontend assets passed/);
  });
});

test('public asset verifier can validate a named vhost through localhost', async () => {
  const indexHtml = fs.readFileSync(path.join(root, 'dist/index.html'));
  await withServer((req, res) => {
    if (req.url?.startsWith('/login')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(indexHtml);
    }
    if (req.url?.startsWith('/assets/')) {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      const name = decodeURIComponent(pathname.slice('/assets/'.length));
      const target = path.join(root, 'dist/assets', name);
      if (!fs.existsSync(target)) { res.statusCode = 404; return res.end('missing'); }
      res.setHeader('Content-Type', name.endsWith('.css') ? 'text/css' : 'application/javascript');
      return fs.createReadStream(target).pipe(res);
    }
    res.statusCode = 404;
    return res.end('missing');
  }, async (baseUrl) => {
    const vhostUrl = baseUrl.replace('127.0.0.1', 'secureasset.test');
    const result = await runAssetVerifier(vhostUrl, ['--connect-host=127.0.0.1']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Public frontend assets passed/);
  });
});

test('public asset verifier reports the serving release when an intermediary returns an older shell', async () => {
  const indexHtml = fs.readFileSync(path.join(root, 'dist/index.html'));
  await withServer((req, res) => {
    if (req.url?.startsWith('/login')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-SecureAsset-Frontend-Release', 'older-release');
      return res.end(indexHtml);
    }
    res.statusCode = 404;
    return res.end('missing');
  }, async (baseUrl) => {
    const result = await runAssetVerifier(baseUrl);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /serving release older-release/);
    assert.match(result.stderr, /expected 2026-09-15-document-vault-mobile-white-premium-cards-v213/);
  });
});
