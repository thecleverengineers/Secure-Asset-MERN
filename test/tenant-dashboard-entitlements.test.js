import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('tenant dashboard resolves both subscription cycles before loading capability analytics', () => {
  const dashboard = read('src/app/pages/app/RoleDashboardPage.tsx');
  assert.match(dashboard, /getMySubscription/);
  assert.match(dashboard, /getMySurveyorSubscription/);
  assert.match(dashboard, /getSurveyorDashboard/);
  assert.match(dashboard, /tenantCapabilities/);
  assert.match(dashboard, /landlordEnabled = landlordSubscription\.status === 'fulfilled'/);
  assert.match(dashboard, /surveyorEnabled = surveyorSubscription\.status === 'fulfilled'/);
  assert.match(dashboard, /landlordEnabled \? getLandlordOverview\(\) : Promise\.resolve\(null\)/);
  assert.match(dashboard, /surveyorEnabled \? getSurveyorDashboard\(\) : Promise\.resolve\(null\)/);
});

test('tenant dashboard renders a surveyor analytics section alongside landlord analytics', () => {
  const dashboard = read('src/app/pages/app/RoleDashboardPage.tsx');
  assert.match(dashboard, /function SurveyorAnalyticsSection/);
  assert.match(dashboard, /Surveyor analytics/);
  assert.match(dashboard, /Find survey jobs/);
  assert.match(dashboard, /<DashboardQuickLinks links=\{links\} navigate=\{navigate\} \/>/);
  assert.match(dashboard, /\{isSurveyor && surveyor && <SurveyorAnalyticsSection data=\{surveyor\} navigate=\{navigate\} \/>\}/);
  assert.match(dashboard, /Tenant workspace · Landlord \+ Surveyor/);
  assert.match(dashboard, /Tenant account retained/);
});

test('dashboard access remains permission-aware for older role maps', () => {
  const rbac = read('server/src/services/rbac.js');
  const middleware = read('server/src/middleware/rolePermission.js');
  assert.match(rbac, /stored\.entries\.find\(\(item\) => item\.key === String\(key\)\.toLowerCase\(\)\) \|\| fallback/);
  assert.match(rbac, /explicit disabled entry/);
  assert.match(middleware, /refreshTenantCapabilities/);
  assert.match(middleware, /syncTenantEntitlements/);
});

test('landlord analytics uses the subscribed capability gate and repairs legacy cycle dates', () => {
  const routes = read('server/src/routes/propertyManagementRoutes.js');
  const middleware = read('server/src/middleware/rolePermission.js');
  const entitlements = read('server/src/services/tenantEntitlements.js');
  const landlordSubscription = read('server/src/services/landlordSubscription.js');
  assert.match(routes, /router\.get\('\/landlord-overview', requireCapabilityPermission\('landlord', 'module:property-management'\), getLandlordOverview\)/);
  assert.match(middleware, /export const requireCapabilityPermission/);
  assert.match(middleware, /rolePermissionDecision\(normalizedCapability, key, action\)/);
  assert.match(entitlements, /effectiveSubscriptionExpiry/);
  assert.match(entitlements, /subscription\.startsAt \|\| subscription\.startDate \|\| subscription\.createdAt/);
  assert.match(landlordSubscription, /Subscription\.find\(\{ user: userId, status: 'active' \}\)/);
  assert.match(landlordSubscription, /const expiresAt = effectiveSubscriptionExpiry/);
});
