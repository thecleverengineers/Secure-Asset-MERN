import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('agreement panel imports every icon used by the runtime page', () => {
  const panel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
  assert.match(panel, /import OpenInNewRounded from '@mui\/icons-material\/OpenInNewRounded';/);
  assert.match(panel, /<OpenInNewRounded/);
});

test('production build type-checks before Vite can activate a release', () => {
  const build = read('scripts/build-production.js');
  const tsc = build.indexOf("node_modules/typescript/bin/tsc");
  const vite = build.indexOf("node_modules/vite/bin/vite.js");
  assert.ok(tsc >= 0, 'production build must run TypeScript');
  assert.ok(vite > tsc, 'TypeScript validation must run before Vite build');
  assert.match(build, /'--noEmit'/);
});

test('global route runtime recovery is one-shot and cache busting', () => {
  const routeError = read('src/app/components/shared/RouteErrorPage.tsx');
  assert.match(routeError, /secureasset_route_recovery:/);
  assert.match(routeError, /__secureasset_runtime_recovery/);
  assert.match(routeError, /sessionStorage\.getItem\(recoveryKey\)/);
  assert.match(routeError, /window\.location\.replace/);
});

test('application error boundary has loop-protected recovery', () => {
  const boundary = read('src/app/components/shared/ApplicationErrorBoundary.tsx');
  assert.match(boundary, /secureasset_application_render_recovery/);
  assert.match(boundary, /__secureasset_app_recovery/);
  assert.match(boundary, /window\.location\.replace/);
});
