import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(file, 'utf8');
const entitlements = read('server/src/services/tenantEntitlements.js');
const lifecycle = read('server/src/services/paymentLifecycle.js');
const surveyor = read('server/src/controllers/surveyorSubscriptionController.js');
const model = read('server/src/models/index.js');

test('tenant subscriptions are independent feature entitlements', () => {
  assert.match(entitlements, /landlordEnabled/);
  assert.match(entitlements, /surveyorEnabled/);
  assert.match(entitlements, /expiresAt/);
  assert.match(entitlements, /syncTenantEntitlements/);
  assert.doesNotMatch(entitlements, /role:\s*['"]landlord['"]/);
  assert.doesNotMatch(entitlements, /role:\s*['"]surveyor['"]/);
  assert.match(model, /role:\s*\{ type: String, enum: \['admin', 'manager', 'landlord', 'tenant', 'user', 'surveyor'\], default: 'tenant'/);
});

test('payment activation synchronises both capabilities without switching or changing role', () => {
  assert.match(lifecycle, /syncTenantEntitlements\(subscription\.user\)/g);
  assert.doesNotMatch(lifecycle, /activeMode:\s*['"]surveyor['"]/);
  assert.match(surveyor, /findOneAndUpdate\(\{ _id: req\.user\._id, role: ['"]tenant['"] \}/);
  assert.match(surveyor, /syncTenantEntitlements\(req\.user\._id\)/);
});

