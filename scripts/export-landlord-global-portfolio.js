import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { buildPortfolio, DEFAULT_TARGET_EMAIL, SEED_VERSION } from './seed-landlord-global-portfolio.js';

const userId = String(process.env.TARGET_USER_ID || '').trim();
const outputDirectory = path.resolve(process.env.OUTPUT_DIR || '/workspace/scratch/secureasset-atlas-import');

if (!/^[a-f\d]{24}$/i.test(userId)) {
  throw new Error('TARGET_USER_ID must be a 24-character MongoDB ObjectId');
}

const oid = (value) => ({ $oid: String(value) });
const date = (value) => ({ $date: new Date(value).toISOString() });
const now = new Date('2026-09-21T00:00:00.000Z');
const expiresAt = new Date('2027-09-21T23:59:59.000Z');

function toExtendedJson(value) {
  if (value instanceof Date) return date(value);
  if (Array.isArray(value)) return value.map(toExtendedJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, toExtendedJson(item)]));
  }
  return value;
}

const sourceProperties = buildPortfolio();
const properties = sourceProperties.map((property) => {
  const propertyId = new mongoose.Types.ObjectId().toHexString();
  return toExtendedJson({
    _id: oid(propertyId),
    ...property,
    owner: oid(userId),
    createdBy: oid(userId),
    updatedBy: oid(userId),
    createdAt: now,
    updatedAt: now,
    __v: 0,
    _propertyId: propertyId,
  });
});

const propertyMedia = properties.flatMap((property) => property.images.map((url, index) => toExtendedJson({
  _id: oid(new mongoose.Types.ObjectId().toHexString()),
  property: oid(property._propertyId),
  owner: oid(userId),
  category: 'property',
  mediaType: 'image',
  url,
  thumbnailUrl: url,
  caption: `${property.title} — gallery image ${index + 1}`,
  altText: `${property.title} property image ${index + 1}`,
  sortOrder: index,
  cover: index === 0,
  visibility: 'public',
  watermark: { enabled: false },
  compressed: true,
  uploadedBy: oid(userId),
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
  __v: 0,
})));

for (const property of properties) delete property._propertyId;

const subscription = toExtendedJson({
  _id: oid(new mongoose.Types.ObjectId().toHexString()),
  user: oid(userId),
  plan: 'enterprise',
  billingCycle: 'yearly',
  amount: 0,
  currency: 'INR',
  status: 'active',
  startsAt: now,
  expiresAt,
  nextRenewalAt: expiresAt,
  limits: {
    properties: 1000000,
    buildings: 1000000,
    apartments: 1000000,
    rooms: 1000000,
    beds: 1000000,
    publicListings: 1000000,
    activeTenants: 1000000,
    storageMB: 10485760,
    teamMembers: 1000000,
    rentAutomation: true,
    advancedReports: true,
    promotions: true,
    apiAccess: true,
  },
  payment: {
    method: 'administrative_activation',
    transactionId: `${SEED_VERSION}-${userId}`,
    gateway: 'system',
    paidAt: now,
    metadata: { reason: 'Requested global demo portfolio' },
  },
  paymentHistory: [],
  renewalHistory: [],
  createdBy: oid(userId),
  updatedBy: oid(userId),
  createdAt: now,
  updatedAt: now,
  __v: 0,
});

const auditLog = toExtendedJson({
  _id: oid(new mongoose.Types.ObjectId().toHexString()),
  user: oid(userId),
  role: 'system',
  action: 'seed_global_landlord_portfolio',
  module: 'properties',
  updatedValue: {
    seedVersion: SEED_VERSION,
    targetEmail: DEFAULT_TARGET_EMAIL,
    counts: { rent: 20, lease: 20, sale: 20 },
    galleryImages: 360,
  },
  createdAt: now,
  __v: 0,
});

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDirectory, 'properties.json'), JSON.stringify(properties, null, 2)),
  writeFile(path.join(outputDirectory, 'propertymedias.json'), JSON.stringify(propertyMedia, null, 2)),
  writeFile(path.join(outputDirectory, 'subscription.json'), JSON.stringify([subscription], null, 2)),
  writeFile(path.join(outputDirectory, 'auditlog.json'), JSON.stringify([auditLog], null, 2)),
]);

console.log(JSON.stringify({
  outputDirectory,
  userId,
  properties: properties.length,
  propertyMedia: propertyMedia.length,
  subscriptions: 1,
  auditLogs: 1,
}, null, 2));
