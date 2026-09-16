import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DEFAULT_PLATFORM_MODULES } from '../server/src/services/platformDefaults.js';
import { canAccessPlatformModule, capabilityRolesForUser, featureAllowed } from '../server/src/services/rbac.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('tenant subscriptions add capabilities without changing the account role', () => {
  const roles = capabilityRolesForUser({ role: 'tenant', landlordEnabled: true, surveyorEnabled: true });
  assert.deepEqual(roles, ['tenant', 'landlord', 'surveyor']);
  assert.equal(capabilityRolesForUser({ role: 'tenant' }).join(','), 'tenant');
});

test('landlord and surveyor modules are independently visible to subscribed tenants', async () => {
  const module = (key) => DEFAULT_PLATFORM_MODULES.find((item) => item.scope === 'app' && item.key === key);
  const tenant = { role: 'tenant', _id: '000000000000000000000001', landlordEnabled: true, surveyorEnabled: true };
  assert.ok(await canAccessPlatformModule(module('property-management'), tenant));
  assert.ok(await canAccessPlatformModule(module('surveyor-dashboard'), tenant));
  for (const key of ['survey-services', 'survey-jobs', 'survey-quotations', 'survey-projects', 'survey-equipment', 'survey-team', 'survey-clients', 'survey-reviews', 'survey-disputes', 'survey-promotions']) {
    assert.ok(await canAccessPlatformModule(module(key), { ...tenant, activeMode: 'surveyor' }), `surveyor module denied: ${key}`);
  }
  assert.ok(await canAccessPlatformModule(module('my-property'), { ...tenant, activeMode: 'regular' }));
  assert.ok(await featureAllowed('module:dashboard', tenant));
  assert.ok(!(await canAccessPlatformModule(module('property-management'), { role: 'tenant', _id: tenant._id })));
});

test('canonical backend guards follow tenant capabilities instead of account-role changes', async () => {
  const regularTenant = { role: 'tenant', _id: '000000000000000000000002' };
  const landlordTenant = { ...regularTenant, landlordEnabled: true };
  const surveyorTenant = { ...regularTenant, surveyorEnabled: true };
  const dualTenant = { ...regularTenant, landlordEnabled: true, surveyorEnabled: true };

  // Base tenant access must include the pages that the tenant sidebar exposes.
  for (const key of ['module:dashboard', 'module:documents', 'module:my-applications', 'module:applications', 'module:subscription', 'module:my-property', 'module:notifications']) {
    assert.ok(await featureAllowed(key, regularTenant), `regular tenant denied ${key}`);
  }
  assert.equal(await featureAllowed('module:property-management', regularTenant), false);

  // A subscription adds capability permissions while the account remains a tenant.
  for (const key of ['module:property-management', 'module:my-listings', 'module:add-my-property', 'module:tenancies', 'module:utility-readings', 'module:rental-invoices']) {
    assert.ok(await featureAllowed(key, landlordTenant), `landlord entitlement denied ${key}`);
  }
  for (const key of ['module:surveyor-dashboard', 'module:survey-job-marketplace', 'module:survey-services', 'module:surveys', 'module:documents']) {
    assert.ok(await featureAllowed(key, surveyorTenant), `surveyor entitlement denied ${key}`);
  }
  assert.ok(await featureAllowed('module:property-management', dualTenant));
  assert.ok(await featureAllowed('module:surveyor-dashboard', dualTenant));

  const module = (key) => DEFAULT_PLATFORM_MODULES.find((item) => item.scope === 'app' && item.key === key);
  for (const key of ['dashboard', 'documents', 'my-applications', 'my-property', 'subscription']) assert.ok(await canAccessPlatformModule(module(key), regularTenant), `regular module denied ${key}`);
  for (const key of ['property-management', 'my-listings', 'add-my-property', 'utility-readings', 'survey-projects', 'active-projects']) assert.ok(await canAccessPlatformModule(module(key), landlordTenant), `landlord module denied ${key}`);
  for (const key of ['surveyor-dashboard', 'survey-job-marketplace', 'survey-services', 'survey-projects']) assert.ok(await canAccessPlatformModule(module(key), surveyorTenant), `surveyor module denied ${key}`);
});

test('sidebar uses separate capability sections and contains no tenant mode switch', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const scope = read('server/src/services/scope.js');
  assert.match(shell, /landlord_features/);
  assert.match(shell, /surveyor_features/);
  assert.match(shell, /tenantCapabilityMenu/);
  assert.match(shell, /same tenant sidebar/);
  assert.doesNotMatch(shell, /Regular Tenant Mode/);
  assert.doesNotMatch(shell, /Landlord Mode/);
  assert.doesNotMatch(shell, /Surveyor Mode/);
  assert.match(scope, /__baseTenantScope/);
  assert.match(scope, /user\.landlordEnabled/);
  assert.match(scope, /user\.surveyorEnabled/);
});

test('existing role permission documents are extended with missing defaults', () => {
  const configuration = read('server/src/services/platformConfiguration.js');
  const rbac = read('server/src/services/rbac.js');
  assert.match(configuration, /missing = defaults\.filter/);
  assert.match(configuration, /\$push: \{ entries: \{ \$each: missing \} \}/);
  assert.match(configuration, /syncTenantEntitlements/);
  assert.match(configuration, /const accessUser = entitlements/);
  assert.match(rbac, /capabilityRolesForUser\(user\)/);
});

test('property management routes keep tenant submission endpoints separate from landlord gates', () => {
  const routes = read('server/src/routes/propertyManagementRoutes.js');
  assert.doesNotMatch(routes, /router\.use\(requireFeaturePermission\('module:property-management'\)\)/);
  assert.match(routes, /router\.post\('\/kyc\/submit', requireFeaturePermission\('module:tenant-kyc', 'create'\)/);
  assert.match(routes, /router\.post\('\/applications', requireFeaturePermission\('module:applications', 'create'\)/);
  assert.match(routes, /router\.post\('\/applications\/:id\/decision', requireFeaturePermission\('module:applications', 'approve'\)/);
  assert.match(routes, /router\.post\('\/applications\/:id\/create-tenancy', requireFeaturePermission\('module:tenancies', 'create'\)/);
});

test('authenticated tenant requests hydrate approved subscription capabilities before route guards run', () => {
  const auth = read('server/src/middleware/auth.js');
  assert.match(auth, /syncTenantEntitlements/);
  assert.match(auth, /req\.user = await hydrateTenantCapabilities\(user\)/);
  assert.match(auth, /user\.landlordEnabled = entitlements\.landlord\.enabled/);
  assert.match(auth, /user\.surveyorEnabled = entitlements\.surveyor\.enabled/);
});

test('subscribed tenant sidebar uses the server contract and has a bounded property fallback', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  assert.match(shell, /const source = new Map\(designedMenu\.map/);
  assert.match(shell, /\[\.\.\.LANDLORD_FEATURE_MENU_KEYS\]\.forEach/);
  assert.match(shell, /const item = source\.get\(key\);/);
  assert.match(modulePage, /LANDLORD_PROPERTY_MODULES/);
  assert.match(modulePage, /if \(landlordPropertyRouteAllowed\) return true/);
  assert.doesNotMatch(modulePage, /configuredModuleKeys/);
});
