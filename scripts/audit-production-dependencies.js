import { spawnSync } from 'node:child_process';
import process from 'node:process';

const transientFailure = /503|service unavailable|429|eai_again|econnreset|etimedout|enetunreach|enotfound|fetch failed|network/i;
const vulnerabilityResult = /npm audit report|found [1-9][0-9]* vulnerabilities|severity:\s*(low|moderate|high|critical)|fix available/i;
const allowUnverifiedAudit = process.env.ALLOW_UNVERIFIED_DEPENDENCY_AUDIT === '1';
const npmArguments = [
  'audit',
  '--omit=dev',
  '--audit-level=high',
  '--fetch-retries=4',
  '--fetch-retry-factor=2',
  '--fetch-retry-mintimeout=1000',
  '--fetch-retry-maxtimeout=10000',
];

function npmCommand() {
  const npmExecPath = String(process.env.npm_execpath || '').trim();
  if (npmExecPath) return { command: process.execPath, prefix: [npmExecPath] };
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', prefix: [] };
}

function execute(extraArguments = []) {
  const executable = npmCommand();
  const result = spawnSync(executable.command, [...executable.prefix, ...npmArguments, ...extraArguments], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env },
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  return { status: result.status ?? 1, output };
}

function print(output) {
  if (output) process.stdout.write(`${output}\n`);
}

for (let attempt = 1; attempt <= 3; attempt += 1) {
  const result = execute();
  if (result.status === 0) {
    print(result.output);
    process.exit(0);
  }
  if (vulnerabilityResult.test(result.output)) {
    print(result.output);
    console.error('Production dependency audit reported vulnerabilities or an invalid dependency tree.');
    process.exit(1);
  }
  if (!transientFailure.test(result.output)) {
    print(result.output);
    console.error('Production dependency audit failed for a non-transient reason.');
    process.exit(1);
  }
  console.warn(`npm advisory service unavailable (attempt ${attempt}/3); retrying dependency audit.`);
  await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
}

const offline = execute(['--offline']);
if (offline.status === 0) {
  print(offline.output);
  process.exit(0);
}
if (vulnerabilityResult.test(offline.output)) {
  print(offline.output);
  console.error('Offline production dependency audit reported vulnerabilities or an invalid dependency tree.');
  process.exit(1);
}

if (allowUnverifiedAudit) {
  console.warn('npm advisory service remained unavailable after retries. Continuing only because ALLOW_UNVERIFIED_DEPENDENCY_AUDIT=1 was explicitly supplied. Run `npm audit --omit=dev --audit-level=high` immediately when registry access is restored.');
  process.exit(0);
}

console.error('npm advisory service remained unavailable after retries and the offline audit could not verify the dependency tree. Refusing an unverified production deployment. Set ALLOW_UNVERIFIED_DEPENDENCY_AUDIT=1 only for an approved emergency deployment.');
process.exit(1);
