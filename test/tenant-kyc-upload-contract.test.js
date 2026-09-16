import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(file, 'utf8');

test('tenant KYC categories and safe upload formats are shared across the upload path', () => {
  const constants = read('server/src/constants/tenantKyc.js');
  const model = read('server/src/models/drive.js');
  const uploadRoutes = read('server/src/routes/uploadRoutes.js');
  const uploadController = read('server/src/controllers/uploadController.js');
  const page = read('src/app/pages/app/TenantKycPage.tsx');
  for (const category of ['tenant_passport_photo', 'tenant_address_proof_front', 'tenant_address_proof_back', 'tenant_government_identity_front', 'tenant_government_identity_back']) {
    assert.match(constants, new RegExp(category));
    assert.match(page, new RegExp(category));
  }
  assert.match(model, /TENANT_KYC_DOCUMENT_CATEGORIES/);
  for (const extension of ['.jpg', '.jpeg', '.png', '.pdf']) assert.ok(constants.includes(`'${extension}'`), `missing ${extension}`);
  assert.match(uploadRoutes, /TENANT_KYC_ALLOWED_EXTENSIONS/);
  assert.match(uploadController, /allowTenantKyc/);
  assert.match(uploadController, /Tenant KYC files must be JPG, JPEG, PNG, or PDF/);
});

test('government identity back side is optional while address proof back side remains required', () => {
  const page = read('src/app/pages/app/TenantKycPage.tsx');
  const controller = read('server/src/controllers/propertyManagementController.js');
  assert.match(page, /Back Side \(Optional\)/);
  assert.match(page, /form\.governmentIdentityFrontFile && form\.addressProofType/);
  assert.doesNotMatch(page, /form\.governmentIdentityFrontFile && form\.governmentIdentityBackFile && form\.addressProofType/);
  assert.match(controller, /governmentIdentity\.documentType, governmentIdentity\.documentId, governmentIdentity\.frontFile,/);
  assert.doesNotMatch(controller, /governmentIdentity\.frontFile, governmentIdentity\.backFile,/);
});
