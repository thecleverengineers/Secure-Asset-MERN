import fs from 'node:fs';
import path from 'node:path';

const key = process.argv[2];
if (!key) process.exit(2);
const file = path.resolve(process.env.APP_DIR || process.cwd(), '.env');
if (!fs.existsSync(file)) process.exit(1);
for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#') || !line.includes('=')) continue;
  const index = line.indexOf('=');
  if (line.slice(0, index).trim() !== key) continue;
  process.stdout.write(line.slice(index + 1).trim().replace(/^['"]|['"]$/g, ''));
  process.exit(0);
}
process.exit(1);
