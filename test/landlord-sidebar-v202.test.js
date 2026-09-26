import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [shell, configuration] = await Promise.all([
  read('src/app/components/layout/AppShell.tsx'),
  read('server/src/services/platformConfiguration.js'),
]);

const requestedKeys = [
  'my-listings', 'applications', 'tenants', 'tenancies', 'tenancy-history', 'property-visits', 'rental-invoices', 'utility-readings',
  'leases', 'payments', 'transactions', 'agreement-templates', 'survey-projects', 'active-projects',
];
const requestedLabels = [
  'My Listings', 'Tenant Applications', 'Manage Tenants', 'Active Tenancy', 'Tenancy History', 'Manage Site Visit', 'Rent Management',
  'Meter Readings', 'Lease Management', 'Track Payments', 'Transactions', 'Manage Templates', 'Manage Hired Surveyors',
  'Active Projects',
];

test('v202 landlord sidebar contains exactly the requested landlord feature keys in order', () => {
  assert.match(shell, /const LANDLORD_FEATURE_MENU_KEYS = \['my-listings', 'survey-jobs', 'applications', 'tenants', 'tenancies', 'tenancy-history', 'property-visits', 'rental-invoices', 'utility-readings', 'leases', 'payments', 'transactions', 'agreement-templates', 'survey-projects', 'active-projects'\]/);
  assert.match(shell, /const landlordMenu = \['dashboard', \.\.\.LANDLORD_FEATURE_MENU_KEYS, 'documents'\]/);
  assert.match(shell, /const source = new Map\(designedMenu\.map/);
  assert.match(shell, /\[\.\.\.LANDLORD_FEATURE_MENU_KEYS\]\.forEach/);
  for (const label of requestedLabels) assert.match(shell, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('v202 hides unrequested landlord modules and keeps the requested labels', () => {
  assert.match(shell, /section === 'landlord_features' \? landlordFeatureLabel\(key, item\.label\)/);
  assert.match(shell, /user\?\.role === 'landlord' && landlordFeatureKeys\.has\(module\.key\) \? landlordFeatureLabel/);
  assert.match(configuration, /const LANDLORD_SIDEBAR_KEYS = new Set\(\[/);
  assert.match(configuration, /String\(user\?\.role \|\| ''\)\.toLowerCase\(\) === 'landlord' && !LANDLORD_SIDEBAR_KEYS\.has\(module\.key\)/);
  for (const key of requestedKeys) assert.match(configuration, new RegExp(`'${key}'`));
  for (const hiddenKey of ['property-management', 'properties', 'tenant-interviews', 'reminder-rules', 'tenant-profiles', 'occupants', 'complaints', 'facilities', 'facility-bookings', 'survey-jobs', 'survey-quotations', 'messages', 'notifications']) {
    assert.doesNotMatch(shell, new RegExp(`const landlordMenu = [^\\n]*'${hiddenKey}'`));
  }
});
