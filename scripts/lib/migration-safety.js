import mongoose from 'mongoose';

const { Types } = mongoose;

export function isValidObjectIdValue(value) {
  return value instanceof Types.ObjectId || (typeof value === 'string' && Types.ObjectId.isValid(value));
}

export function asObjectId(value) {
  if (!isValidObjectIdValue(value)) return undefined;
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(value);
}

export function demoRentalDataEnabled(value = process.env.SEED_DEMO_RENTAL_DATA) {
  if (value === undefined || value === '') return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export function buildLegacyTenantProfileInsert(userId) {
  const user = asObjectId(userId);
  if (!user) throw new Error('A valid tenant user id is required for the tenant-profile migration.');
  return {
    user,
    profileVisibility: 'applications',
    occupation: 'Professional',
    preferences: {
      locations: [],
      propertyTypes: [],
    },
    completedPercent: 10,
  };
}

export function buildLegacyTenantKycInsert(userId) {
  const user = asObjectId(userId);
  if (!user) throw new Error('A valid tenant user id is required for the tenant-KYC migration.');
  return {
    user,
    status: 'incomplete',
    phoneVerified: false,
    emailVerified: false,
    notes: 'Legacy account imported without verifiable KYC DriveFile references. The user must upload the required documents before verification.',
    history: [{ status: 'incomplete', reason: 'Legacy KYC documents require re-submission', at: new Date() }],
  };
}

export const knownInvalidReferencePlaceholders = new Set([
  '',
  'null',
  'undefined',
  'vault-document-id',
  'document-id',
  'file-id',
]);

export function isKnownInvalidReferencePlaceholder(value) {
  return typeof value === 'string' && knownInvalidReferencePlaceholders.has(value.trim().toLowerCase());
}
