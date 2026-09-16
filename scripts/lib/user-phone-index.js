const EXPECTED_KEYS = Object.freeze({ phone: 1 });
const EXPECTED_NAME = 'phone_1';
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

function unsafeOptions(index) {
  return UNSAFE_OPTION_KEYS.filter((key) => {
    if (key === 'hidden') return Boolean(index[key]);
    return index[key] !== undefined;
  });
}

function restoreOptions(index) {
  const options = { name: index.name || EXPECTED_NAME };
  for (const key of ['unique', 'sparse', ...UNSAFE_OPTION_KEYS]) {
    if (index[key] !== undefined) options[key] = index[key];
  }
  return options;
}

function isExpectedIndex(index) {
  return sameValue(index?.key, EXPECTED_KEYS)
    && !index.unique
    && Boolean(index.sparse)
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
 * Repairs only the legacy User { phone: 1 } lookup index.
 * Older releases created a normal non-sparse index. The current optional mobile
 * field requires a sparse lookup index; canonical uniqueness is enforced by
 * user_phone_normalized_unique after identifier migration.
 *
 * TTL, partial, collation, hidden, wildcard, and unique definitions are never
 * weakened or dropped automatically.
 */
export async function repairUserPhoneIndex(collection, { logger = console } = {}) {
  let indexes = await listIndexes(collection);
  const existing = indexes.find((index) => sameValue(index.key, EXPECTED_KEYS));

  if (!existing) {
    const name = await collection.createIndex(EXPECTED_KEYS, {
      name: EXPECTED_NAME,
      sparse: true,
      background: true,
    });
    logger.log(`Created User mobile lookup index: ${collection.collectionName}.${name}`);
    return { action: 'created', name };
  }

  if (isExpectedIndex(existing)) {
    logger.log(`User mobile lookup index is already correct: ${collection.collectionName}.${existing.name}`);
    return { action: 'unchanged', name: existing.name };
  }

  const unsafe = unsafeOptions(existing);
  if (unsafe.length > 0) {
    throw new Error(
      `Refusing to replace ${collection.collectionName}.${existing.name}; it contains unsupported options: ${unsafe.join(', ')}.`,
    );
  }
  if (existing.unique) {
    throw new Error(
      `Refusing to remove uniqueness from ${collection.collectionName}.${existing.name}. `
      + 'Run the authentication identifier migration and review duplicate mobile values before changing this index.',
    );
  }

  const originalOptions = restoreOptions(existing);
  logger.warn?.(
    `Replacing legacy ${collection.collectionName}.${existing.name} `
    + `(sparse=${Boolean(existing.sparse)}) with the required sparse mobile lookup index.`,
  );

  await collection.dropIndex(existing.name);
  try {
    const createdName = await collection.createIndex(EXPECTED_KEYS, {
      name: existing.name || EXPECTED_NAME,
      sparse: true,
      background: true,
    });
    indexes = await listIndexes(collection);
    const repaired = indexes.find((index) => sameValue(index.key, EXPECTED_KEYS));
    if (!repaired || !isExpectedIndex(repaired)) {
      throw new Error('MongoDB created the phone index, but its final options do not match the required sparse definition.');
    }
    logger.log(`Repaired User mobile lookup index: ${collection.collectionName}.${createdName}`);
    return { action: 'repaired', name: createdName };
  } catch (error) {
    try {
      await collection.createIndex(EXPECTED_KEYS, originalOptions);
      logger.error?.(`Restored the original User phone index after repair failure: ${collection.collectionName}.${existing.name}`);
    } catch (restoreError) {
      error.message += ` Original index restoration also failed: ${restoreError.message}`;
    }
    throw error;
  }
}
