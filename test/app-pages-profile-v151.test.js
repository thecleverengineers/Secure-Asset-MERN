import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('My Property and Document Vault remove their desktop hero panels without removing actions', () => {
  const properties = read('src/app/pages/app/MyPropertyPage.tsx');
  const vault = read('src/app/pages/app/DocumentVaultPage.tsx');

  assert.doesNotMatch(properties, /PageHeader/);
  assert.match(properties, /data-secureasset-my-property-toolbar="compact-v151"/);
  assert.match(properties, /Browse properties/);

  assert.doesNotMatch(vault, /PageHeader/);
  assert.doesNotMatch(vault, /sa-vault-desktop-console/);
  assert.match(vault, /data-secureasset-document-vault-toolbar="compact-v151"/);
  assert.match(vault, /New folder/);
  assert.match(vault, /Scan securely to PNG/);
  assert.match(vault, /Upload files/);
});

test('tenant My Applications uses a compact toolbar while all other resource pages keep their normal header', () => {
  const resource = read('src/app/pages/app/ResourcePage.tsx');

  assert.match(resource, /const compactTenantApplicationView = isTenantApplications;/);
  assert.match(resource, /data-secureasset-my-applications-toolbar="compact-v151"/);
  assert.match(resource, /compactTenantApplicationView \? <Stack[\s\S]*: <PageHeader/);
  assert.match(resource, /const pageActions = <Stack/);
  assert.match(resource, /downloadReport\(module, 'csv'\)/);
  assert.match(resource, /onClick=\{\(\) => load\(\)\}/);
});

test('profile dashboard keeps editing in a functional dialog, uploads supported avatars, and refreshes the signed-in user', () => {
  const profile = read('src/app/pages/app/UtilityPage.tsx');

  assert.match(profile, /data-secureasset-profile-static-dashboard="mobile-premium-v158"/);
  assert.match(profile, /data-secureasset-profile-action-items="edit-profile-kyc-v158"/);
  assert.match(profile, /<ProfessionalDialog open=\{editProfileOpen\}/);
  assert.match(profile, /<Box component="form" noValidate onSubmit=\{saveProfile\}/);
  assert.doesNotMatch(profile, /<Paper component="form"/);
  assert.match(profile, /if \(profileNameError\)/);
  assert.match(profile, /if \(!profileDirty\)/);
  assert.match(profile, /const allowedTypes = \['image\/jpeg', 'image\/png', 'image\/webp', 'image\/gif'\]/);
  assert.match(profile, /file\.size > 8 \* 1024 \* 1024/);
  assert.match(profile, /await updateMe\(/);
  assert.match(profile, /await uploadProfileAvatar\(file\)/);
  assert.match(profile, /await refreshUser\(\)/);
  assert.match(profile, /Discard changes/);
  assert.match(profile, /Mobile changes require OTP verification\./);
});
