import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DEFAULT_PLATFORM_MODULES } from '../server/src/services/platformDefaults.js';
import { canAccessPlatformModule, featureAllowed } from '../server/src/services/rbac.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('admin Document Vault remains a visible and usable platform surface', async () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  const configuration = read('server/src/services/platformConfiguration.js');
  const documentModule = DEFAULT_PLATFORM_MODULES.find((item) => item.scope === 'app' && item.key === 'documents');

  assert.ok(documentModule, 'Document Vault default module is required');
  assert.match(shell, /ADMIN_DOCUMENT_VAULT/);
  assert.match(shell, /role !== 'admin' \|\| roleSafe\.some\(\(item\) => item\.key === 'documents'\)/);
  assert.match(configuration, /fallback = DEFAULT_PLATFORM_MODULES\.find\(\(module\) => module\.scope === 'app' && module\.key === 'documents'\)/);
  assert.match(configuration, /effectiveRole === 'admin' && !visible\.some\(\(module\) => module\.key === 'documents'\)/);
  assert.equal(await canAccessPlatformModule({ ...documentModule, enabled: true }, { role: 'admin' }), true);
  assert.equal(await featureAllowed('module:documents', { role: 'admin' }), true);
});

test('landlord and surveyor plan activation is tenant-only across UI and APIs', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  const middleware = read('server/src/middleware/rolePermission.js');
  const landlordRoutes = read('server/src/routes/subscriptionRoutes.js');
  const surveyorRoutes = read('server/src/routes/surveyorSubscriptionRoutes.js');
  const paymentRoutes = read('server/src/routes/subscriptionPaymentRoutes.js');
  const landlordController = read('server/src/controllers/subscriptionController.js');
  const surveyorController = read('server/src/controllers/surveyorSubscriptionController.js');
  const dashboard = read('src/app/pages/app/RoleDashboardPage.tsx');
  const configuration = read('server/src/services/platformConfiguration.js');

  assert.match(shell, /TENANT_ONLY_ACTIVATION_KEYS = new Set\(\['subscription', 'surveyor-subscription'\]\)/);
  assert.match(shell, /landlord: \['dashboard', 'my-listings', 'applications', 'tenancies', 'property-visits', 'rental-invoices', 'utility-readings', 'leases', 'payments', 'agreement-templates', 'survey-projects', 'active-projects', 'documents', 'profile'\]/);
  assert.doesNotMatch(shell, /landlord: \['dashboard', 'subscription'/);
  assert.match(shell, /userSurveyorFeatures && <MenuItem/);
  assert.doesNotMatch(shell, /userSurveyorFeatures \|\| user\?\.role === 'surveyor'/);
  assert.match(modulePage, /TENANT_ONLY_ACTIVATION_MODULES\.has\(module\)\) return user\?\.role === 'tenant'/);
  assert.match(dashboard, /user\?\.role === 'tenant' && <Button variant="outlined" onClick=\{\(\) => navigate\('\/app\/subscription'\)\}/);
  assert.match(middleware, /export const requireTenantSubscriptionAccount/);
  assert.match(landlordRoutes, /requireTenantSubscriptionAccount/);
  assert.match(surveyorRoutes, /requireTenantSubscriptionAccount/);
  assert.match(paymentRoutes, /razorpay\/order'.*requireTenantSubscriptionAccount/);
  assert.match(paymentRoutes, /razorpay\/verify'.*requireTenantSubscriptionAccount/);
  assert.match(landlordController, /Only Tenant accounts can cancel a Landlord subscription/);
  for (const message of [
    'Only tenant accounts can change a Surveyor subscription plan',
    'Only tenant accounts can renew a Surveyor subscription',
    'Only tenant accounts can cancel a Surveyor subscription',
    'Only tenant accounts can change tenant capability mode',
  ]) assert.match(surveyorController, new RegExp(message));
  assert.match(configuration, /TENANT_ONLY_ACTIVATION_MODULE_KEYS/);
  assert.match(configuration, /TENANT_ONLY_ACTIVATION_MODULE_KEYS\.has\(module\.key\)/);
});
