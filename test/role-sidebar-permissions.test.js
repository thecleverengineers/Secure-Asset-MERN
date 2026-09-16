import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RBAC_PLATFORM_MODULES, RESOURCE_ACCESS, defaultPermissionEntriesForRole, getEffectiveRole, LEGACY_ROLE_KEYS, ROLE_KEYS } from '../server/src/services/rbac.js';
import { DEFAULT_PLATFORM_MODULES } from '../server/src/services/platformDefaults.js';

const platformConfiguration = readFileSync(new URL('../server/src/services/platformConfiguration.js', import.meta.url), 'utf8');
const siteController = readFileSync(new URL('../server/src/controllers/siteController.js', import.meta.url), 'utf8');
const resourceController = readFileSync(new URL('../server/src/controllers/resourceController.js', import.meta.url), 'utf8');
const scope = readFileSync(new URL('../server/src/services/scope.js', import.meta.url), 'utf8');
const socket = readFileSync(new URL('../server/src/services/socket.js', import.meta.url), 'utf8');
const appShell = readFileSync(new URL('../src/app/components/layout/AppShell.tsx', import.meta.url), 'utf8');
const modulePage = readFileSync(new URL('../src/app/pages/app/ModulePage.tsx', import.meta.url), 'utf8');
const protectedRoute = readFileSync(new URL('../src/app/components/shared/ProtectedRoute.tsx', import.meta.url), 'utf8');

const byRole = (role) => RBAC_PLATFORM_MODULES.filter((module) => module.metadata?.role === role).map((module) => module.key);

test('role-based sidebar maps Admin, Landlord, Tenant and Surveyor menus from the supplied matrix', () => {
  for (const role of ['admin', 'landlord', 'tenant', 'surveyor']) {
    assert.ok(byRole(role).length >= 8, `${role} should have a complete sidebar map`);
  }
  for (const key of ['users', 'role-permissions', 'properties', 'rental-invoices', 'leases', 'payments', 'subscriptions', 'site-admin']) assert.ok(byRole('admin').includes(key), `admin missing ${key}`);
  for (const key of ['properties', 'add-my-property', 'tenants', 'rental-invoices', 'leases', 'property-sales', 'legal-toolkit', 'subscription']) assert.ok(byRole('landlord').includes(key), `landlord missing ${key}`);
  for (const key of ['marketplace', 'my-applications', 'applications', 'property-visits', 'tenancies', 'subscription', 'agreements', 'notifications']) assert.ok(byRole('tenant').includes(key), `tenant missing ${key}`);
  for (const key of ['assigned-properties', 'surveys', 'survey-reports', 'site-visits', 'documents', 'surveyor-subscription']) assert.ok(byRole('surveyor').includes(key), `surveyor missing ${key}`);
});

test('canonical route guard keys are present for every supported capability', () => {
  const keysFor = (role) => new Set(defaultPermissionEntriesForRole(role).filter((entry) => entry.kind === 'module').map((entry) => entry.key));
  for (const key of ['module:dashboard', 'module:documents', 'module:my-applications', 'module:applications', 'module:subscription', 'module:notifications']) assert.ok(keysFor('tenant').has(key), `tenant missing ${key}`);
  for (const key of ['module:property-management', 'module:tenancies', 'module:utility-readings']) assert.ok(keysFor('landlord').has(key), `landlord missing ${key}`);
  for (const key of ['module:surveyor-dashboard', 'module:surveys', 'module:documents', 'module:notifications']) assert.ok(keysFor('surveyor').has(key), `surveyor missing ${key}`);
  for (const key of ['module:property-management', 'module:documents', 'module:notifications', 'module:utility-readings']) assert.ok(keysFor('admin').has(key), `admin missing ${key}`);
});

test('server returns filtered sidebar plus route/resource enforcement payloads', () => {
  assert.match(platformConfiguration, /canAccessPlatformModule/);
  assert.match(platformConfiguration, /permissionPayloadForModules/);
  assert.match(platformConfiguration, /metadata\?\.sidebarVisible === false/);
  assert.equal(RBAC_PLATFORM_MODULES.find((module) => module.key === 'all-users')?.metadata?.sidebarVisible, false);
  assert.equal(RBAC_PLATFORM_MODULES.find((module) => module.key === 'admin-users')?.metadata?.sidebarVisible, false);
  assert.equal(RBAC_PLATFORM_MODULES.find((module) => module.key === 'landlords')?.metadata?.sidebarVisible, false);
  assert.equal(RBAC_PLATFORM_MODULES.find((module) => module.key === 'users')?.metadata?.sidebarVisible, true);
  assert.equal(RBAC_PLATFORM_MODULES.find((module) => module.key === 'role-permissions')?.metadata?.sidebarVisible, true);
  assert.match(siteController, /effectiveRole/);
  assert.match(siteController, /subscription/);
  assert.match(resourceController, /assertResourceAction/);
  assert.match(resourceController, /configFor\(req, 'create'\)/);
  assert.match(socket, /canResourceAction/);
});

test('role scopes enforce own-data and assigned-data boundaries', () => {
  assert.match(scope, /effectiveRole === 'landlord'/);
  assert.match(scope, /owner: uid/);
  assert.match(scope, /landlord: uid/);
  assert.match(scope, /effectiveRole === 'surveyor'/);
  assert.match(scope, /surveyor: uid/);
  assert.match(scope, /assignedPropertyIds/);
});

test('frontend sidebar and direct module routes use app configuration permissions', () => {
  assert.match(appShell, /getAppConfiguration/);
  assert.match(appShell, /landlord:/);
  assert.match(modulePage, /Access denied/);
  assert.match(modulePage, /allowedModules/);
  assert.match(protectedRoute, /effectiveRole/);
});

test('effective role resolves legacy tenant modes into landlord and surveyor actors', () => {
  assert.equal(getEffectiveRole({ role: 'admin' }), 'admin');
  assert.equal(getEffectiveRole({ role: 'landlord' }), 'landlord');
  assert.equal(getEffectiveRole({ role: 'surveyor' }), 'surveyor');
  assert.equal(getEffectiveRole({ role: 'tenant', landlordEnabled: true, activeMode: 'landlord' }), 'landlord');
  assert.equal(getEffectiveRole({ role: 'tenant', surveyorEnabled: true, activeMode: 'surveyor' }), 'surveyor');
  assert.equal(getEffectiveRole({ role: 'tenant', activeMode: 'regular' }), 'tenant');
});

test('resource action matrix blocks private modules while allowing scoped role workspaces', () => {
  assert.deepEqual(Object.keys(RESOURCE_ACCESS.users), ['admin']);
  assert.ok(RESOURCE_ACCESS.properties.landlord.includes('create'));
  assert.ok(RESOURCE_ACCESS.applications.tenant.includes('create'));
  assert.ok(RESOURCE_ACCESS.applications.landlord.includes('approve'));
  assert.ok(RESOURCE_ACCESS['survey-reports'].surveyor.includes('download'));
  assert.equal(RESOURCE_ACCESS.payments.surveyor.includes('edit'), false);
});


test('feature contract validation recognizes landlord as a first-class role', () => {
  const declaredRoles = new Set([...ROLE_KEYS, ...LEGACY_ROLE_KEYS]);
  assert.ok(declaredRoles.has('landlord'));
  assert.ok(declaredRoles.has('manager'));
  assert.ok(declaredRoles.has('user'));
});


test('enterprise platform module defaults do not contain duplicate scope/key records', () => {
  const counts = new Map();
  for (const module of DEFAULT_PLATFORM_MODULES) {
    const id = `${module.scope}:${module.key}`;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
  assert.deepEqual(duplicates, []);
  assert.equal(DEFAULT_PLATFORM_MODULES.length, counts.size);
});
