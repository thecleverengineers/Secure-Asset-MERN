import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runAutomaticMigrations } from './run-automatic-migrations.js';

const target = process.argv[2];
if (!target) throw new Error('A startup target is required, for example server/src/server.js.');

await runAutomaticMigrations();
await import(pathToFileURL(path.resolve(process.cwd(), target)).href);
