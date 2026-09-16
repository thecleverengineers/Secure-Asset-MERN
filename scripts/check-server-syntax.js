import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : entry.name.endsWith('.js') ? [path.join(dir, entry.name)] : []); }
let failed = false;
for (const file of [...files('server'), ...files('scripts')]) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) { failed = true; console.error(result.stderr || result.stdout); }
}
if (failed) process.exit(1);
console.log('Server JavaScript syntax check passed.');
