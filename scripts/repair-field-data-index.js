import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { FieldData } from '../server/src/models/index.js';

const INDEX_KEYS = { surveyor: 1, offlineId: 1 };
const INDEX_OPTIONS = {
  unique: true,
  partialFilterExpression: { offlineId: { $type: 'string' } },
};
const OFFLINE_LOOKUP_KEYS = { offlineId: 1 };
const OFFLINE_LOOKUP_OPTIONS = {};

function sameKeys(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function listIndexes() {
  try {
    return await FieldData.collection.indexes();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === 'NamespaceNotFound') return [];
    throw error;
  }
}

function isOrdinaryOfflineLookupIndex(index) {
  return sameKeys(index?.key, OFFLINE_LOOKUP_KEYS)
    && !index.unique
    && !index.sparse
    && index.expireAfterSeconds === undefined
    && index.partialFilterExpression === undefined
    && index.collation === undefined
    && index.hidden !== true;
}

function canRepairSparseOfflineLookupIndex(index) {
  return sameKeys(index?.key, OFFLINE_LOOKUP_KEYS)
    && index.sparse === true
    && !index.unique
    && index.expireAfterSeconds === undefined
    && index.partialFilterExpression === undefined
    && index.collation === undefined
    && index.hidden !== true;
}

export async function repairFieldDataIndex({ logger = console } = {}) {
  const indexes = await listIndexes();
  const identityIndex = indexes.find((index) => (
    sameKeys(index.key, INDEX_KEYS)
    && index.unique === true
    && !index.sparse
    && JSON.stringify(index.partialFilterExpression) === JSON.stringify(INDEX_OPTIONS.partialFilterExpression)
  ));
  const offlineLookupIndex = indexes.find((index) => sameKeys(index.key, OFFLINE_LOOKUP_KEYS));
  const lookupIndexIsCorrect = !offlineLookupIndex || isOrdinaryOfflineLookupIndex(offlineLookupIndex);

  if (offlineLookupIndex && !lookupIndexIsCorrect && !canRepairSparseOfflineLookupIndex(offlineLookupIndex)) {
    throw new Error(
      `FieldData offlineId lookup index ${offlineLookupIndex.name} has unsupported options. `
      + 'Only the known legacy sparse index can be repaired automatically; inspect this index before deployment.',
    );
  }

  if (identityIndex && lookupIndexIsCorrect) {
    logger.log?.(`FieldData offline identity index is already correct: ${identityIndex.name}`);
    if (offlineLookupIndex) logger.log?.(`FieldData offlineId lookup index is already correct: ${offlineLookupIndex.name}`);
    return { status: 'already-correct', name: identityIndex.name, lookupName: offlineLookupIndex?.name };
  }

  if (!identityIndex && indexes.length) {
    const duplicates = await FieldData.aggregate([
      { $match: { offlineId: { $type: 'string' } } },
      { $group: { _id: { surveyor: '$surveyor', offlineId: '$offlineId' }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 10 },
    ]).allowDiskUse(true);
    if (duplicates.length) {
      const details = duplicates.map((row) => `${row._id.surveyor}:${row._id.offlineId} (${row.count} records)`).join(', ');
      throw new Error(`FieldData offline identity migration stopped because duplicate surveyor/offlineId records exist: ${details}. Resolve these records before deployment.`);
    }
  }

  for (const index of indexes.filter((candidate) => sameKeys(candidate.key, INDEX_KEYS))) {
    await FieldData.collection.dropIndex(index.name);
    logger.log?.(`Dropped incompatible FieldData index: ${FieldData.collection.collectionName}.${index.name}`);
  }
  let name = identityIndex?.name;
  if (!identityIndex) {
    name = await FieldData.collection.createIndex(INDEX_KEYS, INDEX_OPTIONS);
    logger.log?.(`Created partial unique FieldData index: ${FieldData.collection.collectionName}.${name}`);
  }

  let lookupName = offlineLookupIndex?.name;
  if (offlineLookupIndex && !lookupIndexIsCorrect) {
    await FieldData.collection.dropIndex(offlineLookupIndex.name);
    logger.log?.(`Dropped legacy sparse FieldData lookup index: ${FieldData.collection.collectionName}.${offlineLookupIndex.name}`);
    lookupName = undefined;
  }
  if (!lookupName) {
    lookupName = await FieldData.collection.createIndex(OFFLINE_LOOKUP_KEYS, OFFLINE_LOOKUP_OPTIONS);
    logger.log?.(`Created ordinary FieldData lookup index: ${FieldData.collection.collectionName}.${lookupName}`);
  }

  return { status: 'repaired', name, lookupName };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  try {
    await connectDatabase();
    await repairFieldDataIndex();
    console.log('FieldData offline identity index repaired and verified successfully.');
  } catch (error) {
    console.error('FieldData index repair failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase().catch(() => {});
  }
}
