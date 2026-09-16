import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  analyseManagedProcesses,
  parsePm2ProcessList,
  shouldResetPm2Daemon,
  unmanagedProcessNames,
  verifyManagedProcesses,
} from '../scripts/lib/pm2-release.js';

const root = '/www/secureasset';
const version = '6.0.0';
const projectRoot = path.resolve(import.meta.dirname, '..');
const processEntry = (name, overrides = {}) => ({
  name,
  pid: 4321,
  pm2_env: {
    pm_cwd: root,
    pm_exec_path: `${root}/scripts/start-after-migrations.js`,
    pm_out_log_path: `${root}/logs/${name}-out.log`,
    pm_err_log_path: `${root}/logs/${name}-error.log`,
    version,
    status: 'online',
    ...overrides,
  },
});

const allProcesses = () => [
  processEntry('secureasset'),
  processEntry('secureasset-rental-automation'),
  processEntry('secureasset-notification-delivery'),
  processEntry('secureasset-vault-retention'),
];

test('PM2 reconciliation detects an obsolete /var application process', () => {
  const processes = allProcesses();
  processes[0] = processEntry('secureasset', {
    pm_cwd: '/var/secureasset',
    pm_exec_path: '/var/secureasset/server/src/server.js',
    pm_out_log_path: '/root/.pm2/logs/secureasset-out.log',
    pm_err_log_path: '/root/.pm2/logs/secureasset-error.log',
    version: '0.40.4',
  });
  const result = analyseManagedProcesses(processes, root, version);
  assert.deepEqual(result.stale.map((entry) => entry.name), ['secureasset']);
  assert.match(result.stale[0].issues.join(' '), /\/var\/secureasset/);
  assert.match(result.stale[0].issues.join(' '), /version=0\.40\.4/);
});

test('PM2 verification accepts the current release and requires a live API pid', () => {
  const result = verifyManagedProcesses(allProcesses(), root, version);
  assert.equal(result.ok, true);

  const stopped = allProcesses();
  stopped[0] = processEntry('secureasset', { status: 'errored' });
  stopped[0].pid = 0;
  const failed = verifyManagedProcesses(stopped, root, version);
  assert.equal(failed.ok, false);
  assert.ok(failed.issues.some((issue) => issue.includes('status=errored')));
  assert.ok(failed.issues.some((issue) => issue.includes('no running pid')));
});

test('PM2 reconciliation resets a persisted wait-ready process definition', () => {
  const processes = allProcesses();
  processes[0] = processEntry('secureasset', {
    wait_ready: true,
    listen_timeout: 120_000,
    status: 'waiting restart',
  });
  const result = analyseManagedProcesses(processes, root, version);
  assert.deepEqual(result.stale.map((entry) => entry.name), ['secureasset']);
  assert.match(result.stale[0].issues.join(' '), /wait_ready=true/);
  assert.match(result.stale[0].issues.join(' '), /listen_timeout=120000/);
  assert.match(result.stale[0].issues.join(' '), /status=waiting restart/);
});

test('shared PM2 daemon preserves unrelated applications during SecureAsset deployment', () => {
  const processes = [...allProcesses(), processEntry('kaki-crm')];
  assert.deepEqual(unmanagedProcessNames(processes), ['kaki-crm']);
  assert.equal(shouldResetPm2Daemon(processes), false);
  assert.equal(shouldResetPm2Daemon(processes, true), true);
  assert.equal(shouldResetPm2Daemon(allProcesses()), true);
});

test('deployment waits for HTTP health before strict PM2 verification', () => {
  const ecosystem = fs.readFileSync(path.join(projectRoot, 'ecosystem.config.cjs'), 'utf8');
  const reconciliation = fs.readFileSync(path.join(projectRoot, 'scripts/reconcile-pm2-release.js'), 'utf8');
  const deploy = fs.readFileSync(path.join(projectRoot, 'scripts/deploy-production.sh'), 'utf8');
  const repair = fs.readFileSync(path.join(projectRoot, 'scripts/repair-auth-routing.sh'), 'utf8');

  assert.match(ecosystem, /wait_ready: false/);
  assert.match(ecosystem, /listen_timeout: 0/);
  assert.match(reconciliation, /--wait/);
  assert.match(reconciliation, /waitForApiReadiness/);
  assert.match(reconciliation, /api\/health\/ready/);
  assert.match(reconciliation, /fetch\(url/);
  assert.match(reconciliation, /pm2Diagnostics/);
  assert.match(reconciliation, /waiting restart/);
  assert.match(reconciliation, /\['--silent', 'jlist'\]/);
  assert.match(reconciliation, /parsePm2ProcessList/);
  assert.match(reconciliation, /--reset-daemon/);
  assert.match(reconciliation, /PM2_RESET_DAEMON/);
  assert.match(deploy, /PM2_HEALTH_PORT/);
  assert.match(deploy, /PM2_HEALTH_TIMEOUT_MS/);
  assert.match(deploy, /pm2 logs secureasset/);
  assert.match(deploy, /--reset-daemon/);
  assert.match(deploy, /SECUREASSET_RELEASE_HANDOFF_CONTRACT="v171-stop-drain-and-verify-new-pid"/);
  assert.match(deploy, /startOrReload.*--update-env/);
  assert.match(deploy, /SECUREASSET_DIRECT_ORIGIN_CONTRACT="v175-direct-origin-only"/);
  assert.match(deploy, /APP_NODE_BIN=.*node_modules\/\.bin/);
  assert.match(deploy, /require_local_pm2/);
  assert.match(repair, /PM2_HEALTH_PORT/);
  assert.match(repair, /PM2_HEALTH_TIMEOUT_MS/);
  assert.match(repair, /APP_NODE_BIN=.*node_modules\/\.bin/);
  assert.match(reconciliation, /waitForPreviousProcessesToExit/);
  assert.match(reconciliation, /PM2_STOP_TIMEOUT_MS/);
});

test('PM2 process parser recovers JSON after a startup banner and brackets in strings', () => {
  const payload = [{ name: 'secureasset', pm2_env: { pm_cwd: '/www/sc/[release]', status: 'online' } }];
  const raw = `[PM2] Spawning daemon\n${JSON.stringify(payload)}`;
  assert.deepEqual(parsePm2ProcessList(raw), payload);
});

test('PM2 process parser returns an empty list for a clean empty response', () => {
  assert.deepEqual(parsePm2ProcessList('[]'), []);
  assert.deepEqual(parsePm2ProcessList(' [\n ] '), []);
});
