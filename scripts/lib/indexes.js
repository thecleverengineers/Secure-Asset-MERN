const OPTION_KEYS = [
  'unique',
  'sparse',
  'expireAfterSeconds',
  'partialFilterExpression',
  'collation',
  'hidden',
];

const BOOLEAN_OPTION_KEYS = new Set(['unique', 'sparse', 'hidden']);

const KNOWN_LEGACY_INDEX_REPAIRS = Object.freeze([
  {
    modelName: 'SurveyorSubscription',
    collectionName: 'surveyorsubscriptions',
    keys: { user: 1 },
    allowUniqueDowngrade: true,
    reason: 'Legacy releases incorrectly created one subscription per user. The current subscription history requires a non-unique user index.',
  },
  {
    modelName: 'User',
    collectionName: 'users',
    keys: { phone: 1 },
    allowUniqueDowngrade: false,
    reason: 'Legacy releases created the optional mobile lookup index without sparse=true.',
  },
  {
    modelName: 'FieldData',
    collectionName: 'fielddatas',
    keys: { offlineId: 1 },
    allowUniqueDowngrade: false,
    reason: 'Legacy releases created the optional offline field-data lookup index with sparse=true.',
  },
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

function optionValue(key, value) {
  if (BOOLEAN_OPTION_KEYS.has(key)) return Boolean(value);
  return value;
}

function isDeclaredTextIndex(keys) {
  return Object.values(keys).some((value) => value === 'text');
}

function isExistingTextIndex(index) {
  return Boolean(index?.textIndexVersion || index?.key?._fts === 'text' || index?.weights);
}

function declaredTextWeights(keys, options = {}) {
  const explicitWeights = options.weights || {};
  return Object.fromEntries(
    Object.entries(keys)
      .filter(([, value]) => value === 'text')
      .map(([field]) => [field, Number(explicitWeights[field] ?? 1)]),
  );
}

function existingTextWeights(index) {
  return Object.fromEntries(
    Object.entries(index.weights || {}).map(([field, weight]) => [field, Number(weight)]),
  );
}

function sameTextDefinition(keys, options, existing) {
  if (!sameValue(existingTextWeights(existing), declaredTextWeights(keys, options))) return false;
  const expectedLanguage = options.default_language || 'english';
  const actualLanguage = existing.default_language || 'english';
  const expectedOverride = options.language_override || 'language';
  const actualOverride = existing.language_override || 'language';
  return expectedLanguage === actualLanguage && expectedOverride === actualOverride;
}

export function sameNonTextDefinition(keys, options, existing) {
  if (!sameValue(keys, existing.key)) return false;
  return OPTION_KEYS.every((key) => sameValue(optionValue(key, options[key]), optionValue(key, existing[key])));
}

function safeCreateOptions(rawOptions = {}) {
  const options = { ...rawOptions, background: rawOptions.background ?? true };
  for (const key of BOOLEAN_OPTION_KEYS) {
    if (options[key] === false) delete options[key];
  }
  return options;
}

function matchingKnownLegacyRepair(Model, keys) {
  const collectionName = Model.collection?.collectionName;
  return KNOWN_LEGACY_INDEX_REPAIRS.find((policy) => (
    policy.modelName === Model.modelName
    && policy.collectionName === collectionName
    && sameValue(policy.keys, keys)
  ));
}

function isSafeKnownLegacyMismatch(policy, expectedOptions, existing) {
  if (expectedOptions.unique) return false;
  if (existing.unique && !policy.allowUniqueDowngrade) return false;
  // Never automatically replace TTL, partial, collation, or hidden indexes.
  for (const key of ['expireAfterSeconds', 'partialFilterExpression', 'collation', 'hidden']) {
    if (!sameValue(optionValue(key, expectedOptions[key]), optionValue(key, existing[key]))) return false;
  }
  // The allow-listed migration is limited to ordinary unique/sparse option changes.
  return true;
}

async function repairKnownLegacyIndex(Model, keys, options, existing, { logger }) {
  const policy = matchingKnownLegacyRepair(Model, keys);
  if (!policy || !isSafeKnownLegacyMismatch(policy, options, existing)) return false;

  logger.warn?.(
    `Repairing known legacy index ${Model.collection.collectionName}.${existing.name}: ${policy.reason}`,
  );
  const restoreOptions = safeCreateOptions({
    name: existing.name,
    ...Object.fromEntries(OPTION_KEYS.filter((key) => existing[key] !== undefined).map((key) => [key, existing[key]])),
  });
  await Model.collection.dropIndex(existing.name);
  try {
    const createdName = await Model.collection.createIndex(keys, safeCreateOptions(options));
    logger.log(`Recreated production index: ${Model.collection.collectionName}.${createdName}`);
    return true;
  } catch (error) {
    try {
      await Model.collection.createIndex(keys, restoreOptions);
      logger.error?.(`Restored legacy index after replacement failure: ${Model.collection.collectionName}.${existing.name}`);
    } catch (restoreError) {
      error.message += ` Original index restoration also failed: ${restoreError.message}`;
    }
    throw error;
  }
}

async function listIndexes(Model) {
  try {
    return await Model.collection.indexes();
  } catch (error) {
    // NamespaceNotFound means the collection has not been created yet.
    if (error?.code === 26 || error?.codeName === 'NamespaceNotFound') return [];
    throw error;
  }
}

export async function ensureModelIndexes(Model, {
  repairTextIndexes = true,
  repairKnownLegacyIndexes = false,
  logger = console,
} = {}) {
  const declaredIndexes = Model.schema.indexes();
  let existingIndexes = await listIndexes(Model);

  for (const [keys, rawOptions = {}] of declaredIndexes) {
    const options = safeCreateOptions(rawOptions);

    if (isDeclaredTextIndex(keys)) {
      const textIndexes = existingIndexes.filter(isExistingTextIndex);
      const matching = textIndexes.find((index) => sameTextDefinition(keys, options, index));
      if (matching) continue;

      if (textIndexes.length && !repairTextIndexes) {
        throw new Error(
          `${Model.modelName} has an incompatible legacy text index (${textIndexes.map((index) => index.name).join(', ')}). ` +
          'Run npm run db:repair-indexes before creating production indexes.',
        );
      }

      for (const index of textIndexes) {
        await Model.collection.dropIndex(index.name);
        logger.log(`Dropped incompatible text index: ${Model.collection.collectionName}.${index.name}`);
      }

      const createdName = await Model.collection.createIndex(keys, options);
      logger.log(`Created text index: ${Model.collection.collectionName}.${createdName}`);
      existingIndexes = await listIndexes(Model);
      continue;
    }

    const exact = existingIndexes.find((index) => sameNonTextDefinition(keys, options, index));
    if (exact) continue;

    const sameKey = existingIndexes.find((index) => sameValue(index.key, keys));
    if (sameKey) {
      if (repairKnownLegacyIndexes && await repairKnownLegacyIndex(Model, keys, options, sameKey, { logger })) {
        existingIndexes = await listIndexes(Model);
        continue;
      }
      const existingOptions = Object.fromEntries(OPTION_KEYS.filter((key) => sameKey[key] !== undefined).map((key) => [key, sameKey[key]]));
      const expectedOptions = Object.fromEntries(OPTION_KEYS.filter((key) => options[key] !== undefined).map((key) => [key, options[key]]));
      throw new Error(
        `${Model.modelName} index conflict on ${JSON.stringify(keys)}. Existing index ${sameKey.name} has options ` +
        `${JSON.stringify(existingOptions)} but the model requires ${JSON.stringify(expectedOptions)}. ` +
        'Only explicitly allow-listed legacy indexes are repaired automatically.',
      );
    }

    const createdName = await Model.collection.createIndex(keys, options);
    logger.log(`Created index: ${Model.collection.collectionName}.${createdName}`);
    existingIndexes = await listIndexes(Model);
  }
}

export async function ensureAllModelIndexes(mongoose, options = {}) {
  for (const [name, Model] of Object.entries(mongoose.models)) {
    await ensureModelIndexes(Model, options);
    options.logger?.log?.(`Indexes ensured: ${name}`);
  }
}
