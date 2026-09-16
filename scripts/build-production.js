import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const appDir = path.resolve('.');
const releasesDir = path.join(appDir, '.frontend-releases');
const releaseName = `release-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
const outputDir = path.join(releasesDir, releaseName);
const distPath = path.join(appDir, 'dist');
const temporaryLink = path.join(appDir, `.dist-next-${process.pid}`);

fs.mkdirSync(releasesDir, { recursive: true });
fs.rmSync(outputDir, { recursive: true, force: true });
fs.rmSync(temporaryLink, { force: true });

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: appDir,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.`);
}

try {
  run(process.execPath, [path.join(appDir, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', outputDir, '--emptyOutDir']);
  run(process.execPath, [path.join(appDir, 'scripts/generate-spa-fallbacks.js')], { BUILD_DIST_DIR: outputDir });
  run(process.execPath, [path.join(appDir, 'scripts/verify-production-build.js')], { BUILD_DIST_DIR: outputDir });

  fs.symlinkSync(path.relative(appDir, outputDir), temporaryLink, 'dir');
  try {
    const stat = fs.lstatSync(distPath);
    if (!stat.isSymbolicLink()) {
      const legacyName = `legacy-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      fs.renameSync(distPath, path.join(releasesDir, legacyName));
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  fs.renameSync(temporaryLink, distPath);

  const releases = fs.readdirSync(releasesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, path: path.join(releasesDir, entry.name), mtime: fs.statSync(path.join(releasesDir, entry.name)).mtimeMs }))
    .sort((left, right) => right.mtime - left.mtime);
  for (const stale of releases.slice(4)) fs.rmSync(stale.path, { recursive: true, force: true });

  console.log(`Production frontend activated atomically: ${path.relative(appDir, outputDir)}`);
} catch (error) {
  fs.rmSync(temporaryLink, { force: true });
  fs.rmSync(outputDir, { recursive: true, force: true });
  throw error;
}
