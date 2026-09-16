import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { TenantKyc, TenantProfile } from '../server/src/models/index.js';
import {
  buildLegacyTenantKycInsert,
  buildLegacyTenantProfileInsert,
  demoRentalDataEnabled,
  isKnownInvalidReferencePlaceholder,
} from '../scripts/lib/migration-safety.js';

test('advanced-rental migration creates schema-valid profile data', () => {
  const payload = buildLegacyTenantProfileInsert(new mongoose.Types.ObjectId());
  const document = new TenantProfile(payload);
  assert.equal(document.validateSync(), undefined);
  assert.deepEqual(document.preferences.locations, []);
  assert.deepEqual(document.preferences.propertyTypes, []);
});

test('advanced-rental migration never fabricates KYC ObjectId references', () => {
  const payload = buildLegacyTenantKycInsert(new mongoose.Types.ObjectId());
  const document = new TenantKyc(payload);
  assert.equal(document.validateSync(), undefined);
  assert.equal(document.status, 'incomplete');
  for (const field of ['governmentId', 'addressProof', 'profilePhoto', 'selfie', 'employmentProof']) {
    assert.equal(document[field], undefined);
  }
});

test('demo rental records are opt-in only', () => {
  assert.equal(demoRentalDataEnabled(undefined), false);
  assert.equal(demoRentalDataEnabled('false'), false);
  assert.equal(demoRentalDataEnabled('true'), true);
});

test('only known placeholder reference strings are auto-repairable', () => {
  assert.equal(isKnownInvalidReferencePlaceholder(''), true);
  assert.equal(isKnownInvalidReferencePlaceholder('vault-document-id'), true);
  assert.equal(isKnownInvalidReferencePlaceholder('507f1f77bcf86cd799439011'), false);
  assert.equal(isKnownInvalidReferencePlaceholder('unexpected-reference'), false);
});
