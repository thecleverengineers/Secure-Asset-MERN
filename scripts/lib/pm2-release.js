import path from 'node:path';

/**
 * PM2's `jlist` command normally returns one JSON array, but a newly spawned
 * PM2 7 daemon may write its startup banner to stdout before that array.  A
 * strict JSON.parse on the complete stream then fails even though the process
 * data itself is valid.  Extract the first balanced JSON array while honoring
 * quoted strings and escaped characters so paths, log messages and env values
 * containing brackets cannot truncate the payload.
 */
export function parsePm2ProcessList(rawOutput) {
  const raw = String(rawOutput ?? '').replace(/^\uFEFF/, '').trim();
  if (!raw) return [];

  let directError;
  try {
    const direct = JSON.parse(raw);
    if (Array.isArray(direct)) return direct;
  } catch (error) {
    directError = error;
  }

  for (let start = 0; start < raw.length; start += 1) {
    if (raw[start] !== '[') continue;
    let depth = 0;
    let quoted = false;
    let escaped = false;

    for (let index = start; index < raw.length; index += 1) {
      const character = raw[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') {
        quoted = true;
        continue;
      }
      if (character === '[') depth += 1;
      else if (character === ']') {
        depth -= 1;
        if (depth !== 0) continue;
        try {
          const parsed = JSON.parse(raw.slice(start, index + 1));
          if (Array.isArray(parsed) && parsed.every((entry) => entry && typeof entry === 'object')) {
            return parsed;
          }
        } catch {
          // This bracket pair was a banner or malformed fragment. Continue
          // scanning so a later, valid PM2 JSON array can still be recovered.
        }
        break;
      }
    }
  }

  const detail = directError?.message || 'no JSON array found';
  throw new Error(`PM2 returned invalid process JSON: ${detail}; output=${raw.slice(0, 500)}`);
}

export const managedProcessNames = Object.freeze([
  'secureasset',
  'secureasset-rental-automation',
  'secureasset-notification-delivery',
  'secureasset-vault-retention',
]);

export function unmanagedProcessNames(processes) {
  return [...new Set(
    (Array.isArray(processes) ? processes : [])
      .map((entry) => entry?.name)
      .filter((name) => name && !managedProcessNames.includes(name)),
  )];
}

/**
 * A PM2 daemon can be shared by several applications on the same server.
 * Restarting that daemon is safe only when it contains SecureAsset-managed
 * processes, unless the operator explicitly accepts the global restart.
 */
export function shouldResetPm2Daemon(processes, explicitOverride = false) {
  return unmanagedProcessNames(processes).length === 0 || explicitOverride === true;
}

const normalisePath = (value, cwd = process.cwd()) => {
  if (!value || typeof value !== 'string') return '';
  return path.resolve(cwd, value);
};

const isInside = (candidate, root) => {
  if (!candidate || !root) return false;
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export function analyseManagedProcesses(processes, expectedAppDir, expectedVersion) {
  const expectedRoot = normalisePath(expectedAppDir);
  const byName = new Map(
    (Array.isArray(processes) ? processes : [])
      .filter((entry) => managedProcessNames.includes(entry?.name))
      .map((entry) => [entry.name, entry]),
  );

  const stale = [];
  const missing = [];
  const healthy = [];

  for (const name of managedProcessNames) {
    const entry = byName.get(name);
    if (!entry) {
      missing.push(name);
      continue;
    }

    const env = entry.pm2_env || {};
    const cwd = normalisePath(env.pm_cwd || '');
    const execPath = normalisePath(env.pm_exec_path || '', cwd || expectedRoot);
    const outLog = normalisePath(env.pm_out_log_path || '', cwd || expectedRoot);
    const errorLog = normalisePath(env.pm_err_log_path || '', cwd || expectedRoot);
    const issues = [];

    if (cwd !== expectedRoot) issues.push(`cwd=${cwd || '<missing>'}`);
    if (!isInside(execPath, expectedRoot)) issues.push(`script=${execPath || '<missing>'}`);
    if (expectedVersion && env.version && env.version !== expectedVersion) {
      issues.push(`version=${env.version}`);
    }
    if (outLog && !isInside(outLog, path.join(expectedRoot, 'logs'))) {
      issues.push(`out_log=${outLog}`);
    }
    if (errorLog && !isInside(errorLog, path.join(expectedRoot, 'logs'))) {
      issues.push(`error_log=${errorLog}`);
    }

    // PM2 persists process-level flags across reloads. A previous release that
    // used wait_ready=true can remain stuck in "waiting restart" even after
    // ecosystem.config.cjs changes. Force that definition through --prepare so
    // the new health-gated process is started from a clean PM2 record.
    if (name === 'secureasset') {
      const waitReady = env.wait_ready === true || env.wait_ready === 'true' || env.wait_ready === 1;
      if (waitReady) issues.push('wait_ready=true');
      const listenTimeout = Number(env.listen_timeout);
      if (Number.isFinite(listenTimeout) && listenTimeout > 0) issues.push(`listen_timeout=${listenTimeout}`);
      if (env.status && env.status !== 'online') issues.push(`status=${env.status}`);
    }

    if (issues.length > 0) stale.push({ name, issues });
    else healthy.push({ name, status: env.status, pid: entry.pid || 0 });
  }

  return { expectedRoot, stale, missing, healthy, byName };
}

export function verifyManagedProcesses(processes, expectedAppDir, expectedVersion) {
  const analysis = analyseManagedProcesses(processes, expectedAppDir, expectedVersion);
  const issues = [];

  for (const name of analysis.missing) issues.push(`${name}: missing`);
  for (const entry of analysis.stale) issues.push(`${entry.name}: ${entry.issues.join(', ')}`);

  const api = analysis.byName.get('secureasset');
  if (api) {
    const status = api.pm2_env?.status;
    if (status !== 'online') issues.push(`secureasset: status=${status || '<missing>'}`);
    if (!Number.isInteger(api.pid) || api.pid <= 0) issues.push('secureasset: no running pid');
  }

  for (const name of managedProcessNames.filter((entry) => entry !== 'secureasset')) {
    const worker = analysis.byName.get(name);
    if (worker?.pm2_env?.status === 'errored') issues.push(`${name}: status=errored`);
  }

  return { ...analysis, issues, ok: issues.length === 0 };
}
