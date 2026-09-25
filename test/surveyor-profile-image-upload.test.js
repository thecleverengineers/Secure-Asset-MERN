import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('surveyor profile replaces photo and logo URL inputs with upload fields', () => {
  const page = read('src/app/pages/app/SurveyorProfilePage.tsx');
  assert.doesNotMatch(page, /Profile photograph URL/);
  assert.doesNotMatch(page, /Agency logo URL/);
  assert.match(page, /title="Profile photo"/);
  assert.match(page, /title="Agency logo"/);
  assert.match(page, /type="file"/);
  assert.match(page, /accept="image\/png,image\/jpeg,image\/webp,image\/gif"/);
});

test('surveyor profile images upload through the dedicated authenticated endpoint', () => {
  const page = read('src/app/pages/app/SurveyorProfilePage.tsx');
  const api = read('src/app/services/api.ts');
  const routes = read('server/src/routes/surveyorSubscriptionRoutes.js');
  const assets = read('server/src/controllers/siteAssetController.js');
  assert.match(page, /uploadSurveyorProfileAsset\(profilePhotoFile, 'profile_photo'\)/);
  assert.match(page, /uploadSurveyorProfileAsset\(agencyLogoFile, 'agency_logo'\)/);
  assert.match(api, /\/surveyor-subscriptions\/profile\/assets/);
  assert.match(api, /X-SecureAsset-Profile-Asset/);
  assert.match(routes, /\/profile\/assets/);
  assert.match(assets, /uploadSurveyorProfileAsset/);
  assert.match(assets, /getActiveSurveyorSubscription\(req\.user\._id\)/);
});

test('profile image upload returns SecureAsset URLs and save/publish persists them automatically', () => {
  const page = read('src/app/pages/app/SurveyorProfilePage.tsx');
  const assets = read('server/src/controllers/siteAssetController.js');
  assert.match(page, /uploaded\.profilePhoto = result\.data\.url/);
  assert.match(page, /uploaded\.agencyLogo = result\.data\.url/);
  assert.match(page, /await persistProfile\(\)/);
  assert.match(page, /await setSurveyorProfileVisibility\(next\)/);
  assert.match(assets, /surveyor-profiles\/profile-photos/);
  assert.match(assets, /surveyor-profiles\/agency-logos/);
});
