import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('super admin is a protected global role that inherits administrator capabilities', () => {
  const models = read('server/src/models/index.js');
  const auth = read('server/src/middleware/auth.js');
  const rbac = read('server/src/services/rbac.js');
  assert.match(models, /'super_admin', 'admin'/);
  assert.match(models, /adminScope/);
  assert.match(models, /criticalActionReauth/);
  assert.match(auth, /role === 'super_admin'/);
  assert.match(rbac, /super_admin: 'admin'/);
  assert.match(rbac, /String\(user\?\.role \|\| ''\)\.toLowerCase\(\) === 'super_admin'/);
});

test('super admin control plane exposes protected overview and governance APIs', () => {
  const routes = read('server/src/routes/superAdminRoutes.js');
  const controller = read('server/src/controllers/superAdminController.js');
  const app = read('server/src/app.js');
  assert.match(routes, /authorize\('super_admin'\)/);
  assert.match(routes, /\/overview/);
  assert.match(routes, /\/users\/:userId\/promote/);
  assert.match(routes, /\/users\/:userId\/demote/);
  assert.match(routes, /security-events/);
  assert.match(controller, /At least one active Super Admin must remain/);
  assert.match(controller, /You cannot demote your own Super Admin account/);
  assert.match(controller, /super-admin:promoted/);
  assert.match(app, /\/api\/v1\/super-admin/);
});

test('super admin has dedicated application navigation and control center', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const routes = read('src/app/routes.tsx');
  const page = read('src/app/pages/app/SuperAdminControlCenterPage.tsx');
  const dashboard = read('src/app/pages/app/RoleDashboardPage.tsx');
  assert.match(shell, /SUPER_ADMIN_CONTROL_CENTER/);
  assert.match(shell, /super_admin: \['dashboard', 'super-admin'/);
  assert.match(routes, /SuperAdminControlCenterPage/);
  assert.match(page, /Platform control plane/);
  assert.match(page, /Super Admin governance/);
  assert.match(dashboard, /super_admin:/);
});

test('normal admin bootstrap cannot silently demote a super admin', () => {
  const seed = read('server/src/seeds/ensureAdmin.js');
  const superSeed = read('server/src/seeds/ensureSuperAdmin.js');
  assert.match(seed, /user\.role !== 'super_admin'/);
  assert.match(superSeed, /BOOTSTRAP_SUPER_ADMIN_EMAIL/);
  assert.match(superSeed, /user\.role = 'super_admin'/);
});
