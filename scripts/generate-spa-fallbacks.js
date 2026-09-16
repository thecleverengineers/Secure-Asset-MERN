import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.env.BUILD_DIST_DIR || 'dist');
const indexFile = path.join(dist, 'index.html');
if (!fs.existsSync(indexFile)) throw new Error(`Cannot generate SPA fallbacks before ${indexFile} exists.`);

fs.copyFileSync(indexFile, path.join(dist, '404.html'));
console.log(`SPA fallback generated: ${path.relative(process.cwd(), path.join(dist, '404.html'))}`);
