const EXPECTED_KEYS = Object.freeze({ user: 1 });
const EXPECTED_NAME = 'user_1';
const UNSAFE_OPTION_KEYS = Object.freeze([
  'expireAfterSeconds',
  'partialFilterExpression',
  'collation',
  'hidden',
  'wildcardProjection',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function restoreOptions(index) {
  const options = { name: index.name || EXPECTED_NAME };
  for (const key of ['unique', 'sparse', ...UNSAFE_OPTION_KEYS]) {
    if (index[key] !== undefined) options[key] = index[key];
  }
  return options;
}

function unsafeOptions(index) {
  return UNSAFE_OPTION_KEYS.filter((key) => {
    if (key === 'hidden') return Boolean(index[key]);
    return index[key] !== undefined;
  });
}

function isExpectedIndex(index) {
  return sameValue(index?.key, EXPECTED_KEYS)
    && !index.unique
    && !index.sparse
    && unsafeOptions(index).length === 0;
}

async function listIndexes(collection) {
  try {
    return await collection.indexes();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === 'NamespaceNotFound') return [];
    throw error;
  }
}

/**
 * Repairs only the historical SurveyorSubscription { user: 1 } index.
 * The old release created it as unique, but the current model stores subscription history.
 * Unknown TTL, partial, collation, hidden, or wildcard definitions are never dropped.
 */
export async function repairSurveyorSubscriptionUserIndex(collection, { logger = console } = {}) {
  let indexes = await listIndexes(collection);
  const existing = indexes.find((index) => sameValue(index.key, EXPECTED_KEYS));

  if (!existing) {
    const name = await collection.createIndex(EXPECTED_KEYS, { name: EXPECTED_NAME, background: true });
    logger.log(`Created SurveyorSubscription history index: ${collection.collectionName}.${name}`);
    return { action: 'created', name };
  }

  if (isExpectedIndex(existing)) {
    logger.log(`SurveyorSubscription history index is already correct: ${collection.collectionName}.${existing.name}`);
    return { action: 'unchanged', name: existing.name };
  }

  const unsafe = unsafeOptions(existing);
  if (unsafe.length > 0) {
    throw new Error(
      `Refusing to replace ${collection.collectionName}.${existing.name}; it contains unsupported options: ${unsafe.join(', ')}.`,
    );
  }

  // Only ordinary unique/sparse legacy differences reach this point.
  const originalOptions = restoreOptions(existing);
  logger.warn?.(
    `Replacing legacy ${collection.collectionName}.${existing.name} `
    + `(unique=${Boolean(existing.unique)}, sparse=${Boolean(existing.sparse)}) with a non-unique history index.`,
  );

  await collection.dropIndex(existing.name);
  try {
    const createdName = await collection.createIndex(EXPECTED_KEYS, {
      name: existing.name || EXPECTED_NAME,
      background: true,
    });
    indexes = await listIndexes(collection);
    const repaired = indexes.find((index) => sameValue(index.key, EXPECTED_KEYS));
    if (!repaired || !isExpectedIndex(repaired)) {
      throw new Error('MongoDB created the index, but its final options do not match the required non-unique definition.');
    }
    logger.log(`Repaired SurveyorSubscription history index: ${collection.collectionName}.${createdName}`);
    return { action: 'repaired', name: createdName };
  } catch (error) {
    try {
      await collection.createIndex(EXPECTED_KEYS, originalOptions);
      logger.error?.(`Restored the original index after repair failure: ${collection.collectionName}.${existing.name}`);
    } catch (restoreError) {
      error.message += ` Original index restoration also failed: ${restoreError.message}`;
    }
    throw error;
  }
}
