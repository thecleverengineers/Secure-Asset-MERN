import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('admin approval center centralizes KYC, public listings and subscriptions', () => {
  const page = read('src/app/pages/app/ApprovalCenterPage.tsx');
  const shell = read('src/app/components/layout/AppShell.tsx');
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  assert.match(page, /TenantKycAdminPage embedded/);
  assert.match(page, /reviewSurveyorVerification/);
  assert.match(page, /reviewPropertyPublicListing/);
  assert.match(page, /SubscriptionPaymentReviewPage embedded/);
  assert.match(shell, /label: 'Approval Center'/);
  assert.match(shell, /placeAdminApprovalCenterAfterDashboard/);
  assert.match(modulePage, /module === 'approvals'.*ApprovalCenterPage/);
});

test('landlord public listing requests require administrator approval', () => {
  const models = read('server/src/models/index.js');
  const resources = read('server/src/controllers/resourceController.js');
  const management = read('server/src/controllers/propertyManagementController.js');
  const routes = read('server/src/routes/propertyManagementRoutes.js');
  assert.match(models, /publicListingApproval/);
  assert.match(models, /'not_required', 'pending', 'approved', 'rejected'/);
  assert.match(resources, /publicListingApproval = \{ status: 'pending'/);
  assert.match(resources, /changes\.status = 'pending_approval'/);
  assert.match(management, /reviewPublicListingApproval/);
  assert.match(management, /Property approved and published/);
  assert.match(routes, /public-listing-approval/);
});
