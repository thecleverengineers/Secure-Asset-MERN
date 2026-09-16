import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('profile is a static, mobile-first dashboard with functional account actions', () => {
  const profile = read('src/app/pages/app/UtilityPage.tsx');

  assert.match(profile, /data-secureasset-profile-static-dashboard="mobile-premium-v158"/);
  assert.match(profile, /data-secureasset-profile-summary="image-name-feature-menu-v158"/);
  assert.match(profile, /data-secureasset-profile-name="static-v158"/);
  assert.match(profile, /data-secureasset-profile-action-menu="edit-kyc-v158"/);
  assert.match(profile, /data-secureasset-profile-action-items="edit-profile-kyc-v158"/);
  assert.match(profile, /Edit profile/);
  assert.match(profile, />KYC</);
  assert.match(profile, /data-secureasset-profile-quick-actions="four-visible-slider-v158"/);
  assert.match(profile, /data-secureasset-profile-quick-action-track="four-up-slide-v158"/);
  assert.match(profile, /flex: '0 0 calc\(\(100% - 24px\) \/ 4\)'/);
  assert.match(profile, /overflowX: 'auto'/);
  assert.match(profile, /const vault: ProfileQuickAction/);
  assert.match(profile, /label: 'Vault'/);
  assert.match(profile, /if \(role === 'tenant'\)/);
  assert.match(profile, /if \(role === 'landlord'\)/);
  assert.match(profile, /if \(role === 'surveyor'\)/);
  assert.match(profile, /data-secureasset-profile-personal-details="icon-aligned-v158"/);
  for (const detail of ['Verified mobile', 'Email address', 'Location', 'Account feature', 'KYC status']) assert.match(profile, new RegExp(detail));
  assert.match(profile, /<ProfessionalDialog open=\{editProfileOpen\}/);
  assert.match(profile, /data-secureasset-profile-edit-dialog="functional-v158"/);
  assert.match(profile, /await updateMe\(/);
  assert.match(profile, /await uploadProfileAvatar\(file\)/);
  assert.doesNotMatch(profile, /<Paper component="form"/);
});

test('the shared application header leaves mobile page-title space intentionally blank', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');

  assert.match(shell, /data-secureasset-mobile-app-header="page-title-hidden-v158"/);
  assert.match(shell, /display: \{ xs: 'none', lg: 'block' \}[\s\S]*\{pageTitle\}/);
  assert.doesNotMatch(shell, /\{isMobile && <Box[^>]*>\s*<Typography[^>]*>\{pageTitle\}/);
});
