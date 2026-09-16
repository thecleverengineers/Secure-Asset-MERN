import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const modelSource = fs.readFileSync('server/src/models/index.js', 'utf8');
const controllerSource = fs.readFileSync('server/src/controllers/subscriptionController.js', 'utf8');

test('landlord subscriptions accept administrator-created plan keys', () => {
  assert.doesNotMatch(
    modelSource,
    /plan:\s*\{\s*type:\s*String,\s*enum:\s*\['starter',\s*'professional',\s*'business',\s*'enterprise'\]/,
    'Subscription.plan must not hard-code only the default plan keys',
  );
  assert.match(modelSource, /plan: \{ type: String, required: true, lowercase: true, trim: true, index: true \}/);
  assert.match(controllerSource, /const planKey = String\(req\.body\.plan \|\| 'starter'\)\.trim\(\)\.toLowerCase\(\);/);
  assert.match(controllerSource, /LandlordPlan\.findOne\(\{ key: planKey, active: true \}\)/);
  assert.match(controllerSource, /plan: plan\.key/);
});
