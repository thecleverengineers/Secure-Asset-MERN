import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('app configuration cold start is batched instead of per-module database writes', () => {
  const platform = read('server/src/services/platformConfiguration.js');
  assert.match(platform, /moduleSeedOperations/);
  assert.match(platform, /PlatformModule\.bulkWrite\(moduleSeedOperations/);
  assert.match(platform, /managedModuleOperations/);
  assert.match(platform, /compatibilityOperations/);
  assert.doesNotMatch(platform, /for \(const module of DEFAULT_PLATFORM_MODULES\) \{\s*await PlatformModule\.updateOne/);
});

test('RBAC cold-cache lookups are coalesced and subscription context is cached', () => {
  const rbac = read('server/src/services/rbac.js');
  assert.match(rbac, /subscriptionContextCache/);
  assert.match(rbac, /SUBSCRIPTION_CONTEXT_CACHE_MS = 5_000/);
  assert.match(rbac, /value: pending/);
  assert.match(rbac, /rolePermissionCache\.delete\(normalizedRole\)/);
});

test('temporary app-config failures no longer become frontend access denied', () => {
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  assert.match(modulePage, /configurationQuery\.isPending \|\| configurationQuery\.isError/);
  assert.match(modulePage, /if \(!allowedModules\.length\) return Boolean\(user\)/);
  assert.match(modulePage, /configurationQuery\.isPending \|\| configurationQuery\.isError \|\| !allowedModules\.length/);
});

test('ordinary API requests no longer use the 30-second global timeout', () => {
  const api = read('src/app/services/api.ts');
  assert.match(api, /DEFAULT_REQUEST_TIMEOUT_MS = 90_000/);
  assert.match(api, /AUTH_REQUEST_TIMEOUT_MS = 45_000/);
  assert.match(api, /UPLOAD_REQUEST_TIMEOUT_MS = 180_000/);
  assert.doesNotMatch(api, /DEFAULT_REQUEST_TIMEOUT_MS = 30_000/);
});

test('refreshing the user does not destroy a valid UI session on transient network errors', () => {
  const auth = read('src/app/context/AuthContext.tsx');
  const start = auth.indexOf('const refreshUser');
  const end = auth.indexOf('useEffect(() => {', start);
  const block = auth.slice(start, end);
  assert.match(block, /Preserve/);
  assert.doesNotMatch(block, /clearSession\(\)/);
  assert.doesNotMatch(block, /setUser\(null\)/);
});
