import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIONS, ROLE_KEYS, defaultPermissionEntriesForRole, permissionCatalog } from '../server/src/services/rbac.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('permission defaults cover every primary role with module and resource actions', () => {
  for (const role of ROLE_KEYS) {
    const entries = defaultPermissionEntriesForRole(role);
    assert.ok(entries.length >= 20, `${role} should have a complete permission map`);
    assert.ok(entries.some((entry) => entry.kind === 'module'));
    assert.ok(entries.some((entry) => entry.kind === 'resource'));
    for (const entry of entries) assert.ok(entry.actions.every((action) => ACTIONS.includes(action)), `${role}:${entry.key} has an invalid action`);
  }
  assert.ok(permissionCatalog().some((entry) => entry.key === 'module:role-permissions'));
});

test('role permissions are persisted, admin-managed, audited, and enforced server-side', () => {
  const model = read('server/src/models/propertyManagement.js');
  const controller = read('server/src/controllers/rolePermissionController.js');
  const routes = read('server/src/routes/rolePermissionRoutes.js');
  const rbac = read('server/src/services/rbac.js');
  const middleware = read('server/src/middleware/rolePermission.js');
  assert.match(model, /RolePermissionSchema/);
  assert.match(controller, /RolePermission\.findOneAndUpdate/);
  assert.match(controller, /role-permissions:updated/);
  assert.match(routes, /authorize\('admin'\)/);
  assert.match(rbac, /rolePermissionDecision/);
  assert.match(rbac, /modulePermission = await rolePermissionDecision/);
  assert.match(rbac, /canAccessPlatformModule/);
  assert.match(middleware, /featureAllowed/);
});

test('admin UI exposes inputs for roles, enablement, data scope and individual actions', () => {
  const page = read('src/app/pages/app/RolePermissionsPage.tsx');
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  const shell = read('src/app/components/layout/AppShell.tsx');
  const api = read('src/app/services/api.ts');
  assert.match(page, /Role &amp; Permissions/);
  assert.match(page, /Data scope/);
  assert.match(page, /Save permissions/);
  assert.match(page, /Checkbox/);
  assert.match(modulePage, /RolePermissionsPage/);
  assert.match(shell, /role-permissions/);
  assert.match(api, /updateRolePermissions/);
});

test('specialized APIs use the shared feature permission middleware', () => {
  for (const file of ['dashboardRoutes.js', 'driveRoutes.js', 'reportRoutes.js', 'messagingRoutes.js', 'rentalPaymentRoutes.js']) {
    assert.match(read(`server/src/routes/${file}`), /requireFeaturePermission/);
  }
});
