import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  analyseManagedProcesses,
  managedProcessNames,
  parsePm2ProcessList,
  shouldResetPm2Daemon,
  unmanagedProcessNames,
  verifyManagedProcesses,
} from './lib/pm2-release.js';

const mode = process.argv[2] || '--prepare';
if (!['--prepare', '--stop', '--verify', '--wait', '--reset-daemon', '--status'].includes(mode)) {
  console.error('Usage: node scripts/reconcile-pm2-release.js [--prepare|--stop|--verify|--wait|--reset-daemon|--status]');
  process.exit(2);
}

const appDir = path.resolve(process.env.APP_DIR || process.cwd());
const packageJson = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const pm2Bin = path.join(appDir, 'node_modules', '.bin', process.platform === 'win32' ? 'pm2.cmd' : 'pm2');

const runPm2 = (args, options = {}) => {
  const result = spawnSync(pm2Bin, args, {
    cwd: appDir,
    encoding: 'utf8',
    env: { ...process.env, PM2_HOME: process.env.PM2_HOME || path.join(process.env.HOME || '', '.pm2') },
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`PM2 ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result;
};

const readProcesses = () => {
  // `--silent` prevents PM2 7's startup ASCII banner from sharing stdout with
  // the JSON payload. The parser still tolerates a banner for older daemons.
  const result = runPm2(['--silent', 'jlist']);
  return parsePm2ProcessList(result.stdout || '[]');
};

function pm2Diagnostics() {
  const result = runPm2(['logs', 'secureasset', '--lines', String(process.env.PM2_LOG_LINES || 160), '--nostream'], { allowFailure: true });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  return output ? output.slice(-12_000) : 'PM2 returned no captured log output.';
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function stopTimeout() {
  const value = Number(process.env.PM2_STOP_TIMEOUT_MS || 45_000);
  if (!Number.isSafeInteger(value) || value < 5_000 || value > 300_000) {
    throw new Error('PM2_STOP_TIMEOUT_MS must be an integer between 5000 and 300000.');
  }
  return value;
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

async function waitForPreviousProcessesToExit(previousPids) {
  const trackedPids = [...new Set(previousPids.filter((pid) => Number.isInteger(pid) && pid > 0))];
  const timeoutMs = stopTimeout();
  const deadline = Date.now() + timeoutMs;
  let lastDescription = '';

  while (Date.now() < deadline) {
    const remainingEntries = readProcesses().filter((entry) => managedProcessNames.includes(entry?.name));
    const alivePids = trackedPids.filter(processIsAlive);
    const description = [
      ...remainingEntries.map((entry) => `${entry.name}(pid ${Number(entry.pid || 0)}, ${entry.pm2_env?.status || 'unknown'})`),
      ...alivePids.filter((pid) => !remainingEntries.some((entry) => Number(entry.pid) === pid)).map((pid) => `pid ${pid}`),
    ].join(', ');
    if (!description) return;
    if (description !== lastDescription) {
      console.log(`Waiting for previous SecureAsset processes to exit: ${description}`);
      lastDescription = description;
    }
    await pause(250);
  }

  const remainingEntries = readProcesses().filter((entry) => managedProcessNames.includes(entry?.name));
  const alivePids = trackedPids.filter(processIsAlive);
  throw new Error([
    `Timed out after ${timeoutMs}ms waiting for the previous SecureAsset processes to exit.`,
    remainingEntries.length ? `PM2 definitions remaining: ${remainingEntries.map((entry) => `${entry.name}(pid ${Number(entry.pid || 0)}, ${entry.pm2_env?.status || 'unknown'})`).join(', ')}` : '',
    alivePids.length ? `Previous PIDs still alive: ${alivePids.join(', ')}` : '',
    'PM2 diagnostics:',
    pm2Diagnostics(),
  ].filter(Boolean).join('\n'));
}

function healthTimeout() {
  const value = Number(process.env.PM2_HEALTH_TIMEOUT_MS || process.env.PM2_READY_TIMEOUT_MS || 120_000);
  if (!Number.isSafeInteger(value) || value < 20_000 || value > 600_000) {
    throw new Error('PM2_HEALTH_TIMEOUT_MS must be an integer between 20000 and 600000.');
  }
  return value;
}

function healthUrl() {
  const explicit = String(process.env.PM2_HEALTH_URL || '').trim();
  if (explicit) {
    try { return new URL(explicit).toString(); } catch { throw new Error('PM2_HEALTH_URL must be a valid URL.'); }
  }
  const port = Number(process.env.PM2_HEALTH_PORT || process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PM2_HEALTH_PORT must be an integer between 1 and 65535.');
  return `http://127.0.0.1:${port}/api/health/ready`;
}

async function probeHealth(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body: body.slice(0, 240) };
  } catch (error) {
    return { ok: false, status: 0, body: error?.name === 'AbortError' ? 'health probe timed out' : String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForApiReadiness() {
  const timeoutMs = healthTimeout();
  const deadline = Date.now() + timeoutMs;
  const url = healthUrl();
  let lastStatus = '';
  let lastHealth = '';

  while (Date.now() < deadline) {
    const processes = readProcesses();
    const api = processes.find((entry) => entry?.name === 'secureasset');
    const status = String(api?.pm2_env?.status || 'missing');
    const pid = Number(api?.pid || 0);

    if (status !== lastStatus) {
      console.log(`Waiting for SecureAsset HTTP health: PM2 status=${status}, pid=${pid || 0}`);
      lastStatus = status;
    }

    if (status === 'errored' || status === 'stopped' || status === 'waiting restart') {
      throw new Error([
        `SecureAsset entered a restart state before HTTP health became ready (status=${status}, pid=${pid || 0}).`,
        'PM2 diagnostics:',
        pm2Diagnostics(),
      ].join('\n'));
    }

    if (status === 'online' && pid > 0) {
      const health = await probeHealth(url);
      const healthState = `${health.status}:${health.body}`;
      if (health.ok) {
        console.log(`SecureAsset HTTP health is ready: ${url}`);
        return analyseManagedProcesses(processes, appDir, packageJson.version);
      }
      if (healthState !== lastHealth) {
        console.log(`SecureAsset HTTP health pending: ${health.status || 'unreachable'} ${health.body}`);
        lastHealth = healthState;
      }
    }

    await pause(Math.min(1_000, Math.max(1, deadline - Date.now())));
  }

  throw new Error([
    `Timed out after ${timeoutMs}ms waiting for SecureAsset HTTP health at ${url}.`,
    'PM2 diagnostics:',
    pm2Diagnostics(),
  ].join('\n'));
}

const describe = (analysis) => {
  console.log(`Expected PM2 application root: ${analysis.expectedRoot}`);
  if (analysis.missing.length > 0) console.log(`Missing managed processes: ${analysis.missing.join(', ')}`);
  for (const entry of analysis.stale) console.log(`Stale PM2 process ${entry.name}: ${entry.issues.join('; ')}`);
  for (const entry of analysis.healthy) console.log(`Aligned PM2 process ${entry.name}: ${entry.status || 'unknown'} (pid ${entry.pid || 0})`);
};

try {
  const processes = readProcesses();
  if (mode === '--reset-daemon') {
    const unmanaged = unmanagedProcessNames(processes);
    const explicitOverride = process.env.PM2_RESET_DAEMON === '1';
    if (!shouldResetPm2Daemon(processes, explicitOverride)) {
      console.log([
        `Shared PM2 daemon contains unrelated applications (${unmanaged.join(', ')}).`,
        'Skipping the global daemon reset to keep those applications running.',
        'SecureAsset processes will be reconciled and reloaded individually.',
        'Set PM2_RESET_DAEMON=1 only when a full shared-daemon restart is intentionally approved.',
      ].join(' '));
      process.exit(0);
    }
    console.log(unmanaged.length > 0
      ? `Resetting PM2 daemon with explicit override; unmanaged applications: ${unmanaged.join(', ')}`
      : 'Resetting the PM2 daemon so it loads the current release runtime.');
    runPm2(['kill'], { allowFailure: true });
    console.log('PM2 daemon reset complete.');
    process.exit(0);
  }

  if (mode === '--prepare') {
    const analysis = analyseManagedProcesses(processes, appDir, packageJson.version);
    describe(analysis);
    if (analysis.stale.length > 0) {
      const staleNames = analysis.stale.map((entry) => entry.name);
      console.log(`Deleting stale PM2 definitions before activation: ${staleNames.join(', ')}`);
      runPm2(['delete', ...staleNames]);
    } else {
      console.log('No stale PM2 definitions require deletion.');
    }
    process.exit(0);
  }

  if (mode === '--stop') {
    const activeEntries = processes.filter((entry) => managedProcessNames.includes(entry?.name));
    const activeNames = [...new Set(activeEntries.map((entry) => entry.name))];
    if (activeNames.length === 0) {
      console.log('No SecureAsset PM2 processes require stopping.');
      process.exit(0);
    }
    const previousPids = activeEntries.map((entry) => Number(entry.pid || 0));
    console.log(`Stopping previous SecureAsset PM2 processes: ${activeEntries.map((entry) => `${entry.name}(pid ${Number(entry.pid || 0)})`).join(', ')}`);
    runPm2(['delete', ...activeNames]);
    await waitForPreviousProcessesToExit(previousPids);
    console.log('Previous SecureAsset PM2 processes stopped.');
    process.exit(0);
  }

  if (mode === '--verify') {
    const result = verifyManagedProcesses(processes, appDir, packageJson.version);
    describe(result);
    if (!result.ok) {
      console.error(`PM2 release verification failed:\n- ${result.issues.join('\n- ')}`);
      process.exit(1);
    }
    console.log(`PM2 release verification passed for ${managedProcessNames.length} managed processes.`);
    process.exit(0);
  }

  if (mode === '--wait') {
    const analysis = await waitForApiReadiness();
    describe(analysis);
    console.log('SecureAsset HTTP health verification passed.');
    process.exit(0);
  }

  describe(analyseManagedProcesses(processes, appDir, packageJson.version));
} catch (error) {
  console.error(`PM2 release reconciliation failed: ${error.message}`);
  process.exit(1);
}
