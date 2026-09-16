import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parsePm2ProcessList } from './lib/pm2-release.js';

const VALID_MODES = new Set(['--clear', '--verify-pm2', '--status']);
const SOCKET_LINK = /^socket:\[(\d+)\]$/;
const LISTEN_STATE = '0A';

function resolveExisting(value) {
  const resolved = path.resolve(value);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function isInside(candidate, root) {
  if (!candidate || !root) return false;
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function readText(filename) {
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch {
    return '';
  }
}

function validPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('SECUREASSET_HTTP_PORT must be an integer between 1 and 65535.');
  }
  return port;
}

export function parseListeningSocketInodes(contents, port) {
  const inodes = new Set();
  for (const line of String(contents || '').split(/\r?\n/).slice(1)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 10 || fields[3] !== LISTEN_STATE) continue;
    const [, portHex = ''] = String(fields[1] || '').split(':');
    if (Number.parseInt(portHex, 16) !== port) continue;
    const inode = String(fields[9] || '').trim();
    if (/^\d+$/.test(inode)) inodes.add(inode);
  }
  return inodes;
}

function socketInodesForPort(port, procRoot = '/proc') {
  const inodes = new Set();
  let readable = false;
  for (const file of ['net/tcp', 'net/tcp6']) {
    try {
      const parsed = parseListeningSocketInodes(fs.readFileSync(path.join(procRoot, file), 'utf8'), port);
      readable = true;
      for (const inode of parsed) inodes.add(inode);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  if (!readable) throw new Error(`Cannot inspect ${procRoot}/net/tcp to verify the HTTP listener.`);
  return inodes;
}

function processPidsForSockets(inodes, procRoot = '/proc') {
  const pids = new Set();
  let unreadable = 0;
  for (const entry of fs.readdirSync(procRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    const pid = Number(entry.name);
    const fdDirectory = path.join(procRoot, entry.name, 'fd');
    let descriptors;
    try {
      descriptors = fs.readdirSync(fdDirectory);
    } catch (error) {
      if (!['ENOENT', 'ESRCH'].includes(error?.code)) unreadable += 1;
      continue;
    }
    for (const descriptor of descriptors) {
      try {
        const target = fs.readlinkSync(path.join(fdDirectory, descriptor));
        const match = SOCKET_LINK.exec(target);
        if (match && inodes.has(match[1])) {
          pids.add(pid);
          break;
        }
      } catch {
        // A process can exit while its descriptor directory is being scanned.
      }
    }
  }
  return { pids: [...pids].sort((left, right) => left - right), unreadable };
}

function listenerPidsFromSs(port) {
  const result = spawnSync('ss', ['-H', '-ltnp', `sport = :${port}`], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return [];
  return [...new Set([...String(result.stdout || '').matchAll(/pid=(\d+)/g)].map((match) => Number(match[1])))]
    .filter((pid) => Number.isInteger(pid) && pid > 0)
    .sort((left, right) => left - right);
}

export function findListenerPids(port, { procRoot = '/proc' } = {}) {
  const inodes = socketInodesForPort(port, procRoot);
  if (inodes.size === 0) return [];
  const fromProc = processPidsForSockets(inodes, procRoot);
  if (fromProc.pids.length > 0) return fromProc.pids;
  const fromSs = listenerPidsFromSs(port);
  if (fromSs.length > 0) return fromSs;
  const permissionNote = fromProc.unreadable > 0 ? ' Access to one or more /proc PID directories was denied.' : '';
  throw new Error(`Port ${port} is listening, but the owning PID could not be determined.${permissionNote} Run this release as root so it can safely verify the listener owner.`);
}

export function describeProcess(pid, appDir) {
  const processRoot = `/proc/${pid}`;
  let cwd = '';
  let executable = '';
  try { cwd = fs.realpathSync(path.join(processRoot, 'cwd')); } catch { /* process may have exited */ }
  try { executable = fs.realpathSync(path.join(processRoot, 'exe')); } catch { /* process may have exited */ }
  const command = readText(path.join(processRoot, 'cmdline')).split('\0').filter(Boolean).join(' ');
  const ownsListener = isInside(cwd, appDir) || command.includes(appDir) || executable.includes(appDir);
  return { pid, cwd, executable, command, ownsListener };
}

function formatProcess(processInfo) {
  const fields = [
    `pid=${processInfo.pid}`,
    `cwd=${processInfo.cwd || '<unavailable>'}`,
    `exe=${processInfo.executable || '<unavailable>'}`,
    `command=${processInfo.command || '<unavailable>'}`,
  ];
  return fields.join('; ');
}

function listenerDetails(port, appDir) {
  return findListenerPids(port).map((pid) => describeProcess(pid, appDir));
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForListenerPidsToExit(port, pids, appDir, timeoutMs) {
  const targetPids = new Set(pids);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const active = listenerDetails(port, appDir).filter((entry) => targetPids.has(entry.pid));
    if (active.length === 0) return;
    await pause(100);
  }
  const active = listenerDetails(port, appDir).filter((entry) => targetPids.has(entry.pid));
  if (active.length > 0) throw new Error(`Timed out waiting for ${active.map(formatProcess).join(' | ')} to release port ${port}.`);
}

async function clearSecureAssetListeners(port, appDir) {
  const listeners = listenerDetails(port, appDir);
  if (listeners.length === 0) {
    console.log(`No process is listening on SecureAsset port ${port}.`);
    return;
  }
  const foreign = listeners.filter((entry) => !entry.ownsListener);
  if (foreign.length > 0) {
    throw new Error([
      `Refusing to stop a non-SecureAsset process on port ${port}.`,
      ...foreign.map((entry) => `- ${formatProcess(entry)}`),
      `Expected a process owned by ${appDir}. Resolve the port conflict manually; no foreign process was changed.`,
    ].join('\n'));
  }

  for (const listener of listeners) {
    console.log(`Stopping stale SecureAsset HTTP listener: ${formatProcess(listener)}`);
    try { process.kill(listener.pid, 'SIGTERM'); } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
  }
  try {
    await waitForListenerPidsToExit(port, listeners.map((entry) => entry.pid), appDir, 12_000);
  } catch (error) {
    const remaining = listenerDetails(port, appDir).filter((entry) => listeners.some((candidate) => candidate.pid === entry.pid));
    for (const listener of remaining) {
      console.warn(`SecureAsset listener did not exit after SIGTERM; sending SIGKILL to pid ${listener.pid}.`);
      try { process.kill(listener.pid, 'SIGKILL'); } catch (killError) {
        if (killError?.code !== 'ESRCH') throw killError;
      }
    }
    await waitForListenerPidsToExit(port, listeners.map((entry) => entry.pid), appDir, 5_000);
  }
  if (listenerDetails(port, appDir).length > 0) throw new Error(`Port ${port} is still occupied after SecureAsset listener cleanup.`);
  console.log(`Released SecureAsset port ${port} before starting the new PM2 process.`);
}

function pm2ApiPid(appDir) {
  const pm2Bin = path.join(appDir, 'node_modules', '.bin', process.platform === 'win32' ? 'pm2.cmd' : 'pm2');
  const result = spawnSync(pm2Bin, ['--silent', 'jlist'], {
    cwd: appDir,
    encoding: 'utf8',
    env: { ...process.env, PM2_HOME: process.env.PM2_HOME || path.join(process.env.HOME || '', '.pm2') },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`PM2 jlist failed: ${(result.stderr || result.stdout || '').trim()}`);
  const api = parsePm2ProcessList(result.stdout || '[]').find((entry) => entry?.name === 'secureasset');
  const pid = Number(api?.pid || 0);
  if (api?.pm2_env?.status !== 'online' || !Number.isInteger(pid) || pid <= 0) {
    throw new Error(`PM2 does not report an online SecureAsset process (status=${api?.pm2_env?.status || 'missing'}, pid=${pid || 0}).`);
  }
  return pid;
}

function verifyPm2Listener(port, appDir) {
  const expectedPid = pm2ApiPid(appDir);
  const listeners = listenerDetails(port, appDir);
  if (listeners.length === 0) throw new Error(`PM2 reports SecureAsset pid ${expectedPid}, but no process is listening on port ${port}.`);
  const listenerPids = listeners.map((entry) => entry.pid);
  if (listenerPids.length !== 1 || listenerPids[0] !== expectedPid) {
    throw new Error([
      `Port ${port} is not owned exclusively by the active PM2 SecureAsset process (expected pid ${expectedPid}).`,
      ...listeners.map((entry) => `- ${formatProcess(entry)}`),
    ].join('\n'));
  }
  console.log(`SecureAsset PM2 process owns HTTP port ${port} (pid ${expectedPid}).`);
}

async function main() {
  const mode = process.argv.slice(2).find((value) => value.startsWith('--')) || '--status';
  if (!VALID_MODES.has(mode)) {
    throw new Error('Usage: node scripts/reconcile-http-listener.js [--clear|--verify-pm2|--status]');
  }
  const appDir = resolveExisting(process.env.APP_DIR || process.cwd());
  const port = validPort(process.env.SECUREASSET_HTTP_PORT || process.env.PORT || 5000);
  if (mode === '--clear') return clearSecureAssetListeners(port, appDir);
  if (mode === '--verify-pm2') return verifyPm2Listener(port, appDir);
  const listeners = listenerDetails(port, appDir);
  if (listeners.length === 0) console.log(`No process is listening on SecureAsset port ${port}.`);
  else console.log(listeners.map((entry) => `Listener on ${port}: ${formatProcess(entry)}`).join('\n'));
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`HTTP listener reconciliation failed: ${error?.message || error}`);
    process.exitCode = 1;
  });
}
