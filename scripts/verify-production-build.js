import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.env.BUILD_DIST_DIR || 'dist');
const required = [
  path.join(dist, 'index.html'), path.join(dist, '404.html'), path.join(dist, '_redirects'),
  path.join(dist, '.htaccess'), path.join(dist, 'web.config'),
  path.resolve('server/src/server.js'), path.resolve('ecosystem.config.cjs'),
];
const missing = required.filter((entry) => !fs.existsSync(entry));
if (missing.length) {
  console.error(`Production build verification failed. Missing: ${missing.map((entry) => path.relative(process.cwd(), entry)).join(', ')}`);
  process.exit(1);
}
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const assetReferences = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
if (!assetReferences.length) {
  console.error('Production build verification failed: Vite asset references were not found.');
  process.exit(1);
}
for (const reference of assetReferences) {
  const target = path.join(dist, reference.replace(/^\//, ''));
  if (!fs.existsSync(target)) {
    console.error(`Production build verification failed: ${reference} is referenced but missing.`);
    process.exit(1);
  }
}
console.log(`Production build verified: ${path.relative(process.cwd(), dist)} contains SPA fallbacks and ${assetReferences.length} entry asset(s).`);
