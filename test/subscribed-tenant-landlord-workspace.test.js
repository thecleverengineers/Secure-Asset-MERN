import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('active landlord subscriber tenants get the focused landlord workspace navigation', () => {
  const source = read('../src/app/components/layout/AppShell.tsx');
  for (const [label, path] of [
    ['Dashboard', '/app/dashboard'],
    ['My Listings', '/app/my-listings'],
    ['Tenant Applications', '/app/applications'],
    ['Tenancies', '/app/tenancies'],
    ['Documents', '/app/documents'],
    ['Tenancy History', '/app/tenancy-history'],
  ]) {
    assert.ok(source.includes(`label: '${label}'`), `${label} is in the subscriber menu`);
    assert.ok(source.includes(`path: '${path}'`), `${label} has its canonical route`);
  }
  assert.match(source, /tenantSubscription\.checked \? tenantSubscription\.landlord : userLandlordFeatures/);
  assert.match(source, /hasLandlordSubscription[\s\S]*?Log out/);
});

test('landlord dashboard summaries are scoped to owned tenancies and notifications', () => {
  const controller = read('../server/src/controllers/propertyManagementController.js');
  const dashboard = read('../src/app/pages/app/RoleDashboardPage.tsx');
  assert.match(controller, /Tenancy\.countDocuments\(\{ landlord: owner, status: 'active' \}\)/);
  assert.match(controller, /Notification\.find\(\{ user: owner \}\).*limit\(5\)/);
  assert.match(controller, /activeTenancies, scheduledInterviews/);
  assert.match(controller, /data: \{ \.\.\.usageData, recentUpdates/);
  for (const label of ['Listings', 'Tenant applications', 'Active tenancies', 'Rent due', 'Recent updates']) {
    assert.ok(dashboard.includes(label), `dashboard includes ${label}`);
  }
  assert.match(dashboard, /navigate\('\/app\/notifications'\)/);
});

test('subscribed tenant settings link directly to the vault security code flow', () => {
  const profile = read('../src/app/pages/app/UtilityPage.tsx');
  const vault = read('../src/app/pages/app/DocumentVaultPage.tsx');
  assert.match(profile, /Vault Security'.*Change 6-digit code.*'\/app\/documents'/);
  assert.match(vault, /6-digit security code/);
  assert.match(vault, /No SMS verification is required/);
  assert.doesNotMatch(vault, /Fast2SMS before saving this six-digit security code/);
});

test('vault PIN setup accepts the PIN directly and returns immediate vault access', () => {
  const api = read('../src/app/services/api.ts');
  const controller = read('../server/src/controllers/authController.js');
  const routes = read('../server/src/routes/authRoutes.js');
  assert.match(api, /setVaultPin\(pin: string\)/);
  assert.match(api, /body: JSON\.stringify\(\{ pin \}\)/);
  assert.ok(controller.includes('const vaultPinSchema = z.object({ pin: z.string().regex(/^\\d{6}$/) }).strict();'));
  const setter = controller.slice(controller.indexOf('export const setVaultPin'), controller.indexOf('export const unlockVaultPin'));
  assert.doesNotMatch(setter, /parsed\.data\.otp/);
  assert.doesNotMatch(setter, /SMS verification code/);
  assert.match(setter, /signVaultPinUnlockToken\(user\)/);
  assert.match(routes, /router\.post\('\/vault-pin\/set', authenticate, credentialLimiter, setVaultPin\)/);
});
