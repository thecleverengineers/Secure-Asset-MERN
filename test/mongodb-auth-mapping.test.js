import test from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../server/src/models/index.js';
import {
  identifierDescriptor, normalizeEmail, normalizeIndianMobile,
} from '../server/src/utils/identity.js';
import { analyzeAuthIdentifiers } from '../scripts/migrate-auth-identifiers.js';
import { ensureModelIndexes, sameNonTextDefinition } from '../scripts/lib/indexes.js';
import { repairSurveyorSubscriptionUserIndex } from '../scripts/lib/surveyor-subscription-index.js';
import { repairUserPhoneIndex } from '../scripts/lib/user-phone-index.js';

test('email and mobile identifiers normalize to stable production values', () => {
  assert.equal(normalizeEmail('  Admin@Example.COM  '), 'admin@example.com');
  assert.equal(normalizeIndianMobile('+91 97079 49651'), '9707949651');
  assert.equal(normalizeIndianMobile('09707949651'), '9707949651');
  assert.equal(identifierDescriptor('ADMIN@example.com').normalized, 'admin@example.com');
  assert.equal(identifierDescriptor('+91 9707949651').normalized, '9707949651');
});

test('user validation stores canonical fields for both login identifiers', async () => {
  const user = new User({
    name: 'Canonical User',
    email: '  Canonical@Example.COM ',
    phone: '+91 97079 49651',
    password: 'StrongPass123',
  });
  await user.validate();
  assert.equal(user.email, 'canonical@example.com');
  assert.equal(user.emailNormalized, 'canonical@example.com');
  assert.equal(user.phone, '9707949651');
  assert.equal(user.phoneNormalized, '9707949651');
});

test('auth identifier migration detects normalized duplicates before writing', () => {
  const report = analyzeAuthIdentifiers([
    { _id: 'a', email: 'Same@Example.com', phone: '+91 9707949651' },
    { _id: 'b', email: 'same@example.COM', phone: '09707949651' },
  ]);
  assert.equal(report.duplicateEmails.length, 1);
  assert.equal(report.duplicateMobiles.length, 1);
});

test('missing false index flags are semantically equivalent to explicit false', () => {
  assert.equal(sameNonTextDefinition(
    { user: 1 },
    { unique: false, sparse: false },
    { key: { user: 1 } },
  ), true);
});

test('known SurveyorSubscription legacy unique index is repaired safely', async () => {
  let indexes = [{ name: '_id_', key: { _id: 1 } }, { name: 'user_1', key: { user: 1 }, unique: true }];
  const operations = [];
  const Model = {
    modelName: 'SurveyorSubscription',
    schema: { indexes: () => [[{ user: 1 }, { background: true }]] },
    collection: {
      collectionName: 'surveyorsubscriptions',
      indexes: async () => indexes,
      dropIndex: async (name) => {
        operations.push(`drop:${name}`);
        indexes = indexes.filter((index) => index.name !== name);
      },
      createIndex: async (keys, options) => {
        operations.push(`create:${JSON.stringify(keys)}:${Boolean(options.unique)}`);
        indexes.push({ name: 'user_1', key: keys, ...(options.unique ? { unique: true } : {}) });
        return 'user_1';
      },
    },
  };
  await ensureModelIndexes(Model, { repairKnownLegacyIndexes: true, logger: { log() {}, warn() {} } });
  assert.deepEqual(operations, ['drop:user_1', 'create:{"user":1}:false']);
});


test('dedicated SurveyorSubscription preflight replaces the legacy unique user index', async () => {
  let indexes = [
    { name: '_id_', key: { _id: 1 } },
    { name: 'user_1', key: { user: 1 }, unique: true },
  ];
  const operations = [];
  const collection = {
    collectionName: 'surveyorsubscriptions',
    indexes: async () => indexes,
    dropIndex: async (name) => {
      operations.push(`drop:${name}`);
      indexes = indexes.filter((index) => index.name !== name);
    },
    createIndex: async (keys, options) => {
      operations.push(`create:${options.name}:${Boolean(options.unique)}`);
      indexes.push({ name: options.name, key: keys, ...(options.unique ? { unique: true } : {}) });
      return options.name;
    },
  };

  const result = await repairSurveyorSubscriptionUserIndex(collection, {
    logger: { log() {}, warn() {}, error() {} },
  });

  assert.equal(result.action, 'repaired');
  assert.deepEqual(operations, ['drop:user_1', 'create:user_1:false']);
});

test('dedicated SurveyorSubscription preflight refuses unknown TTL definitions', async () => {
  const collection = {
    collectionName: 'surveyorsubscriptions',
    indexes: async () => [
      { name: '_id_', key: { _id: 1 } },
      { name: 'user_1', key: { user: 1 }, unique: true, expireAfterSeconds: 60 },
    ],
  };

  await assert.rejects(
    repairSurveyorSubscriptionUserIndex(collection, { logger: { log() {}, warn() {} } }),
    /unsupported options: expireAfterSeconds/,
  );
});


test('known legacy User phone index without sparse is repaired safely', async () => {
  let indexes = [{ name: '_id_', key: { _id: 1 } }, { name: 'phone_1', key: { phone: 1 } }];
  const operations = [];
  const Model = {
    modelName: 'User',
    schema: { indexes: () => [[{ phone: 1 }, { sparse: true, background: true }]] },
    collection: {
      collectionName: 'users',
      indexes: async () => indexes,
      dropIndex: async (name) => {
        operations.push(`drop:${name}`);
        indexes = indexes.filter((index) => index.name !== name);
      },
      createIndex: async (keys, options) => {
        operations.push(`create:${JSON.stringify(keys)}:${Boolean(options.sparse)}`);
        indexes.push({ name: 'phone_1', key: keys, ...(options.sparse ? { sparse: true } : {}) });
        return 'phone_1';
      },
    },
  };

  await ensureModelIndexes(Model, { repairKnownLegacyIndexes: true, logger: { log() {}, warn() {} } });
  assert.deepEqual(operations, ['drop:phone_1', 'create:{"phone":1}:true']);
});

test('dedicated User phone preflight replaces a non-sparse lookup index', async () => {
  let indexes = [
    { name: '_id_', key: { _id: 1 } },
    { name: 'phone_1', key: { phone: 1 } },
  ];
  const operations = [];
  const collection = {
    collectionName: 'users',
    indexes: async () => indexes,
    dropIndex: async (name) => {
      operations.push(`drop:${name}`);
      indexes = indexes.filter((index) => index.name !== name);
    },
    createIndex: async (keys, options) => {
      operations.push(`create:${options.name}:${Boolean(options.sparse)}`);
      indexes.push({ name: options.name, key: keys, ...(options.sparse ? { sparse: true } : {}) });
      return options.name;
    },
  };

  const result = await repairUserPhoneIndex(collection, {
    logger: { log() {}, warn() {}, error() {} },
  });

  assert.equal(result.action, 'repaired');
  assert.deepEqual(operations, ['drop:phone_1', 'create:phone_1:true']);
});

test('dedicated User phone preflight refuses to weaken a unique index', async () => {
  const collection = {
    collectionName: 'users',
    indexes: async () => [
      { name: '_id_', key: { _id: 1 } },
      { name: 'phone_1', key: { phone: 1 }, unique: true },
    ],
  };

  await assert.rejects(
    repairUserPhoneIndex(collection, { logger: { log() {}, warn() {} } }),
    /Refusing to remove uniqueness/,
  );
});

test('dedicated User phone preflight restores the original index after a failed replacement', async () => {
  let indexes = [
    { name: '_id_', key: { _id: 1 } },
    { name: 'phone_1', key: { phone: 1 } },
  ];
  const operations = [];
  let createAttempts = 0;
  const collection = {
    collectionName: 'users',
    indexes: async () => indexes,
    dropIndex: async (name) => {
      operations.push(`drop:${name}`);
      indexes = indexes.filter((index) => index.name !== name);
    },
    createIndex: async (keys, options) => {
      createAttempts += 1;
      operations.push(`create:${Boolean(options.sparse)}`);
      if (createAttempts === 1) throw new Error('simulated create failure');
      indexes.push({ name: options.name, key: keys, ...(options.sparse ? { sparse: true } : {}) });
      return options.name;
    },
  };

  await assert.rejects(
    repairUserPhoneIndex(collection, { logger: { log() {}, warn() {}, error() {} } }),
    /simulated create failure/,
  );
  assert.deepEqual(operations, ['drop:phone_1', 'create:true', 'create:false']);
  assert.ok(indexes.some((index) => index.name === 'phone_1' && !index.sparse));
});
