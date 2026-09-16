import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(file, 'utf8');

test('tenant KYC review has a dedicated admin workspace with secure document previews', () => {
  const page = read('src/app/pages/app/TenantKycAdminPage.tsx');
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  const api = read('src/app/services/api.ts');
  const routes = read('server/src/routes/propertyManagementRoutes.js');
  const controller = read('server/src/controllers/propertyManagementController.js');
  const resources = read('server/src/services/resources.js');

  assert.match(modulePage, /TenantKycAdminPage/);
  assert.match(modulePage, /module === 'tenant-kyc' && \['admin', 'manager'\]/);
  assert.match(page, /reviewTenantKyc/);
  assert.match(page, /Approve KYC/);
  assert.match(page, /Reject KYC/);
  assert.match(page, /TenantKycDocumentPreview/);
  assert.match(api, /fetchTenantKycDocumentBlob/);
  assert.match(routes, /kyc\/documents\/:documentId\/content/);
  assert.match(routes, /requireFeaturePermission\('module:tenant-kyc', 'view'\)/);
  assert.match(controller, /TENANT_KYC_DOCUMENT_CATEGORIES/);
  assert.match(controller, /You can only preview your own KYC documents/);
  for (const path of ['governmentIdentity.frontFile', 'governmentIdentity.backFile', 'addressProofDetails.frontFile', 'addressProofDetails.backFile', 'passportPhoto.file']) {
    assert.match(resources, new RegExp(path.replaceAll('.', '\\.')));
  }
});

test('KYC review UI uses application dialogs instead of native browser dialogs', () => {
  const page = read('src/app/pages/app/TenantKycAdminPage.tsx');
  assert.doesNotMatch(page, /\b(?:alert|prompt|confirm)\s*\(/);
});
