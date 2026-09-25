import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('surveyor verification uses its own non-admin upload endpoint', () => {
  const page = read('src/app/pages/app/SurveyorVerificationPage.tsx');
  const routes = read('server/src/routes/surveyorSubscriptionRoutes.js');
  const assets = read('server/src/controllers/siteAssetController.js');
  const api = read('src/app/services/api.ts');
  assert.match(page, /uploadSurveyorVerificationAsset/);
  assert.doesNotMatch(page, /uploadSiteAsset/);
  assert.match(routes, /\/verification\/assets/);
  assert.match(routes, /uploadSurveyorVerificationAsset/);
  assert.match(assets, /surveyor-verification:asset-uploaded/);
  assert.match(assets, /getActiveSurveyorSubscription/);
  assert.match(api, /\/surveyor-subscriptions\/verification\/assets/);
});

test('surveyor cannot view or write bank verification during self-service submission', () => {
  const page = read('src/app/pages/app/SurveyorVerificationPage.tsx');
  const controller = read('server/src/controllers/surveyorSubscriptionController.js');
  assert.doesNotMatch(page, /Bank account name/);
  assert.doesNotMatch(page, /Bank verification status/);
  assert.match(page, /delete editable\[key\]/);
  assert.match(controller, /select\('-bankVerification'\)/);
  const allowedStart = controller.indexOf("const allowed = ['legalName'");
  const allowedEnd = controller.indexOf('];', allowedStart);
  const allowedBlock = controller.slice(allowedStart, allowedEnd);
  assert.doesNotMatch(allowedBlock, /bankVerification/);
});

test('bank verification remains server-controlled and pending by default', () => {
  const model = read('server/src/models/surveyor.js');
  const controller = read('server/src/controllers/surveyorSubscriptionController.js');
  assert.match(model, /enum: \['pending', 'verified', 'rejected'\], default: 'pending'/);
  assert.match(controller, /bankVerification: \{ status: 'pending' \}/);
  assert.match(controller, /verification\.bankVerification = \{/);
  assert.match(controller, /status: 'pending'/);
});

test('surveyor retains explicit submit-for-review workflow', () => {
  const page = read('src/app/pages/app/SurveyorVerificationPage.tsx');
  const controller = read('server/src/controllers/surveyorSubscriptionController.js');
  assert.match(page, /Submit for review/);
  assert.match(page, /submitSurveyorVerification\(\)/);
  assert.match(controller, /verification\.status = 'submitted'/);
  assert.match(controller, /Verification submitted for review/);
});
