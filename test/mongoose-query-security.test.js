import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { Subscription, User } from '../server/src/models/index.js';
import { identifierDescriptor } from '../server/src/utils/identity.js';
import { rejectUnsafeObjectKeys } from '../server/src/middleware/requestContext.js';

const dbSource = fs.readFileSync(new URL('../server/src/config/db.js', import.meta.url), 'utf8');

test('database configuration preserves trusted application query operators', () => {
  assert.match(dbSource, /mongoose\.set\('sanitizeFilter', false\)/);
  assert.doesNotMatch(dbSource, /mongoose\.set\('sanitizeFilter', true\)/);

  mongoose.set('sanitizeFilter', false);
  const now = new Date('2026-06-30T08:49:12.211Z');
  const query = Subscription.find({ status: 'active', expiresAt: { $gt: now } });
  query._castConditions();
  assert.equal(query.error(), undefined);
  assert.deepEqual(query.getFilter().expiresAt, { $gt: now });
});

test('email and mobile identifier queries retain $or and $in selectors', () => {
  mongoose.set('sanitizeFilter', false);
  const mobile = User.findOne(identifierDescriptor('+91 97079 49651').query);
  mobile._castConditions();
  assert.equal(mobile.error(), undefined);
  const mobileFilter = mobile.getFilter();
  assert.ok(Array.isArray(mobileFilter.$or));
  assert.deepEqual(mobileFilter.$or.find((item) => item.phone)?.phone?.$in, [
    '9707949651', '+919707949651', '919707949651', '09707949651',
  ]);

  const email = User.findOne(identifierDescriptor(' ADMIN@EXAMPLE.COM ').query);
  email._castConditions();
  assert.equal(email.error(), undefined);
  assert.ok(Array.isArray(email.getFilter().$or));
});

test('HTTP boundary rejects MongoDB operators, dotted keys and prototype keys', () => {
  for (const request of [
    { body: { filter: { $gt: 1 } }, query: {} },
    { body: { 'profile.role': 'admin' }, query: {} },
    { body: {}, query: { $where: 'true' } },
    { body: JSON.parse('{"__proto__":{"admin":true}}'), query: {} },
  ]) {
    let received;
    rejectUnsafeObjectKeys(request, null, (error) => { received = error; });
    assert.equal(received?.statusCode, 400);
  }

  let safeError = 'not-called';
  rejectUnsafeObjectKeys({ body: { profile: { region: 'Nagaland' } }, query: { city: 'Dimapur' } }, null, (error) => { safeError = error; });
  assert.equal(safeError, undefined);
});
