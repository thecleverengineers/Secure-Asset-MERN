import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('public Surveyor discovery is restricted to active tenant subscriptions', () => {
  const controller = read('server/src/controllers/publicController.js');
  const eligibility = read('server/src/services/publicSurveyorEligibility.js');
  const siteController = read('server/src/controllers/siteController.js');

  assert.match(eligibility, /status: \{ \$in: \['active', 'expiring_soon'\] \},[\s\S]*expiresAt: \{ \$gt: now \}/);
  assert.match(eligibility, /populate\(\{ path: 'plan', select: 'active' \}\)/);
  assert.match(eligibility, /subscription\.plan && subscription\.plan\.active !== false/);
  assert.match(eligibility, /role: 'tenant',[\s\S]*status: 'active'/);
  assert.doesNotMatch(eligibility, /grace_period|status: 'trial'/);
  assert.match(siteController, /activePublicSurveyorUserIds/);
  assert.match(controller, /activePublicSurveyorUserIds/);
  assert.match(controller, /activePublicSurveyorUserIds\(\);[\s\S]*SurveyorProfile\.find\(filter\)/);
  assert.match(controller, /activePublicSurveyorUserIds\(\);[\s\S]*SurveyorProfile\.findOne\(/);
});
