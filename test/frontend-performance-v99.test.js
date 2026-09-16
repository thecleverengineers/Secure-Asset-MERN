import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('premium frontend keeps heavy workspaces out of the module resolver entry', () => {
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  assert.match(modulePage, /const DocumentVaultPage = lazyWithRetry/);
  assert.match(modulePage, /const DesignStudioPage = lazyWithRetry/);
  assert.match(modulePage, /const ResourcePage = lazyWithRetry/);
  assert.doesNotMatch(modulePage, /import (?:ResourcePage|DocumentVaultPage|DesignStudioPage) from/);
});

test('charts are loaded through a lazy boundary and do not enter the dashboard module', () => {
  const dashboard = read('src/app/pages/app/RoleDashboardPage.tsx');
  assert.match(dashboard, /const DashboardCharts = lazyWithRetry/);
  assert.doesNotMatch(dashboard, /from ['"]recharts['"]/);
  assert.match(read('src/app/components/dashboard/DashboardCharts.tsx'), /from ['"]recharts['"]/);
});

test('MUI icon catalog uses explicit imports and TanStack owns server-state caching', () => {
  assert.doesNotMatch(read('src/app/iconLibrary.tsx'), /import \* as .*@mui\/icons-material/);
  assert.match(read('src/app/App.tsx'), /QueryClientProvider/);
  assert.match(read('src/app/context/SiteContext.tsx'), /useQuery/);
  assert.match(read('src/app/pages/MarketplacePage.tsx'), /prefetchQuery/);
  assert.equal(JSON.parse(read('package.json')).dependencies['@tanstack/react-query'], '5.90.5');
});

test('responsive images reserve layout space and negotiate modern formats', () => {
  const image = read('src/app/components/shared/OptimizedImage.tsx');
  assert.match(image, /image\/avif/);
  assert.match(image, /srcSet/);
  assert.match(image, /width=\{width\}/);
  assert.match(image, /height=\{height\}/);
  assert.match(image, /loading=\{loading \|\| \(priority \? 'eager' : 'lazy'\)\}/);
});

test('font and HTML delivery do not depend on a remote stylesheet', () => {
  assert.doesNotMatch(read('src/styles/fonts.css'), /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(read('src/styles/fonts.css'), /url\('\/fonts\/open-sans-latin-variable\.woff2'\)/);
  assert.match(read('index.html'), /rel="preload"[^>]+fonts\/open-sans-latin-variable\.woff2/);
  assert.ok(fs.statSync(path.join(root, 'public/fonts/open-sans-latin-variable.woff2')).size > 1000);
});

test('HTML and fingerprinted assets have opposite cache policies', () => {
  const spa = read('server/src/middleware/spa.js');
  assert.match(spa, /no-store, no-cache, must-revalidate/);
  assert.match(spa, /max-age=31536000, immutable/);
  assert.match(read('deploy/nginx/secureasset-static.conf.template'), /location \^~ \/fonts\//);
});
