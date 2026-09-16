import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function runScript(script, appDir, extraEnv = {}) {
  return spawnSync(process.execPath, [path.join(projectRoot, script)], {
    cwd: projectRoot,
    env: { ...process.env, ...extraEnv, APP_DIR: appDir },
    encoding: 'utf8',
  });
}

function readEnv(file) {
  const values = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

function readOneClickTemplate() {
  const templatePath = path.join(projectRoot, '.env.oneclick.example');
  if (fs.existsSync(templatePath)) return fs.readFileSync(templatePath, 'utf8');

  // Release archives intentionally exclude dot-file templates. Reuse the
  // configurator's built-in safe defaults to create the legacy template used
  // by this upgrade regression test instead of requiring a forbidden secret
  // or an archive-specific hidden file.
  const fallbackDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secureasset-env-template-'));
  try {
    const configured = runScript('scripts/configure-production-env.js', fallbackDir, {
      APP_URL: 'https://secureasset.in',
      PUBLIC_APP_URL: 'https://secureasset.in',
      CLIENT_URL: 'https://secureasset.in',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/secureasset',
    });
    assert.equal(configured.status, 0, configured.stderr || configured.stdout);
    return fs.readFileSync(path.join(fallbackDir, '.env'), 'utf8');
  } finally {
    fs.rmSync(fallbackDir, { recursive: true, force: true });
  }
}

test('one-click environment upgrades receive every required worker schedule', () => {
  const appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secureasset-env-'));
  try {
    const template = readOneClickTemplate()
      // Simulate an environment created by the older one-click template.
      .replace(/^RENT_AUTOMATION_CRON=.*$/m, 'RENT_AUTOMATION_CRON=7 1 * * *')
      .replace(/^NOTIFICATION_DELIVERY_CRON=.*\n/m, '')
      .replace(/^NOTIFICATION_BATCH_SIZE=.*\n/m, '')
      .replace(/^VITE_API_URL=.*$/m, 'VITE_API_URL=http://localhost:5000/api/v1');
    fs.writeFileSync(path.join(appDir, '.env.oneclick.example'), template);

    const configured = runScript('scripts/configure-production-env.js', appDir);
    assert.equal(configured.status, 0, configured.stderr || configured.stdout);

    const values = readEnv(path.join(appDir, '.env'));
    assert.equal(values.NOTIFICATION_DELIVERY_CRON, '* * * * *');
    assert.equal(values.NOTIFICATION_BATCH_SIZE, '200');
    assert.equal(values.RENT_AUTOMATION_CRON, '* * * * *');
    assert.equal(values.VAULT_PURGE_CRON, '17 2 * * *');
    assert.equal(values.VITE_API_URL, '/api/v1');

    const validated = runScript('scripts/validate-production-env.js', appDir);
    assert.equal(validated.status, 0, validated.stderr || validated.stdout);
    assert.match(validated.stdout, /Production environment validation passed/);
  } finally {
    fs.rmSync(appDir, { recursive: true, force: true });
  }
});

test('production environment removes legacy external-edge settings on upgrade', () => {
  const appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secureasset-direct-origin-env-'));
  try {
    fs.writeFileSync(path.join(appDir, '.env'), [
      'NODE_ENV=production',
      'MONGODB_URI=mongodb://127.0.0.1:27017/secureasset',
      'CLIENT_URL=https://secureasset.in',
      'PUBLIC_APP_URL=https://secureasset.in',
      'CLOUDFLARE_ZONE_ID=old-zone',
      'CLOUDFLARE_API_TOKEN=old-token',
      'VITE_API_URL=/api/v1',
    ].join('\n'));
    const configured = runScript('scripts/configure-production-env.js', appDir);
    assert.equal(configured.status, 0, configured.stderr || configured.stdout);
    const values = readEnv(path.join(appDir, '.env'));
    assert.equal(Object.keys(values).some((key) => /^CLOUDFLARE_/.test(key)), false);
    assert.match(configured.stdout, /Removed legacy external-edge settings: 2/);
  } finally {
    fs.rmSync(appDir, { recursive: true, force: true });
  }
});

test('a release without dot-file templates self-heals from built-in safe defaults', () => {
  const appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secureasset-env-fallback-'));
  try {
    const configured = runScript('scripts/configure-production-env.js', appDir, {
      APP_URL: '',
      PUBLIC_APP_URL: '',
      CLIENT_URL: '',
      DOMAIN: '',
      MONGODB_URI: '',
    });
    assert.equal(configured.status, 0, configured.stderr || configured.stdout);
    assert.match(configured.stderr, /No environment template was found; using built-in safe defaults/);

    const values = readEnv(path.join(appDir, '.env'));
    assert.equal(values.MONGODB_URI, 'mongodb://127.0.0.1:27017/secureasset');
    assert.equal(values.PUBLIC_APP_URL, 'https://secureasset.in');
    assert.equal(values.CLIENT_URL, 'https://secureasset.in');
    assert.equal(values.VITE_API_URL, '/api/v1');
    assert.equal(values.LEGACY_PUBLIC_UPLOADS, 'false');
    assert.equal(values.SEED_DEMO_RENTAL_DATA, 'false');
    assert.equal(values.SMTP_REQUIRE_TLS, 'true');
    assert.equal(values.SMTP_TLS_REJECT_UNAUTHORIZED, 'true');
    assert.ok((values.JWT_ACCESS_SECRET || '').length >= 64);
    assert.ok((values.JWT_REFRESH_SECRET || '').length >= 64);
    assert.match(values.ENCRYPTION_MASTER_KEY_BASE64 || '', /^[A-Za-z0-9+/]+={0,2}$/);
    assert.equal(Buffer.from(values.ENCRYPTION_MASTER_KEY_BASE64, 'base64').length, 32);
    assert.ok((values.VAULT_ENCRYPTION_KEY || '').length >= 64);

    const validated = runScript('scripts/validate-production-env.js', appDir);
    assert.equal(validated.status, 0, validated.stderr || validated.stdout);
    assert.match(validated.stdout, /Production environment validation passed/);
  } finally {
    fs.rmSync(appDir, { recursive: true, force: true });
  }
});
