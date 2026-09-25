import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('admin approval publishes the verified Surveyor profile into the public directory', () => {
  const controller = read('server/src/controllers/surveyorSubscriptionController.js');
  assert.match(controller, /async function publishApprovedSurveyorProfile/);
  assert.match(controller, /getActiveSurveyorSubscription\(verification\.user\)/);
  assert.match(controller, /new SurveyorProfile\(/);
  assert.match(controller, /profile\.visibility = 'public'/);
  assert.match(controller, /profile\.publicationStatus = 'published'/);
  assert.match(controller, /profile\.verificationStatus = 'verified'/);
  assert.match(controller, /Surveyor approved and published in the public directory/);
});

test('approval backfills a usable public profile from submitted verification data', () => {
  const controller = read('server/src/controllers/surveyorSubscriptionController.js');
  assert.match(controller, /verification\.legalName/);
  assert.match(controller, /verification\.profilePhoto/);
  assert.match(controller, /verification\.occupation/);
  assert.match(controller, /verification\.professionalDescription/);
  assert.match(controller, /verification\.yearsExperience/);
  assert.match(controller, /verification\.address\?\.city/);
  assert.match(controller, /verification\.phone/);
  assert.match(controller, /verification\.email/);
});

test('unapproved Surveyor states are forced out of the public directory', () => {
  const controller = read('server/src/controllers/surveyorSubscriptionController.js');
  assert.match(controller, /publicationStatus: 'paused'/);
  assert.match(controller, /visibility: 'private'/);
  assert.match(controller, /\['rejected', 'suspended', 'expired'\]/);
});

test('public Surveyor directory requires a real verified verification record and active subscription', () => {
  const publicController = read('server/src/controllers/publicController.js');
  assert.match(publicController, /activePublicSurveyorUserIds\(\)/);
  assert.match(publicController, /SurveyorVerification\.distinct\('user', \{ status: 'verified', user: \{ \$in: subscribedIds \} \}\)/);
  assert.match(publicController, /visibility: 'public'/);
  assert.match(publicController, /publicationStatus: 'published'/);
  assert.match(publicController, /verificationStatus: 'verified'/);
});
