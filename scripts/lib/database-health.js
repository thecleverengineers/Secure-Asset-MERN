export async function verifyMongoCompatibility(connection, { logger = console } = {}) {
  const database = connection?.db;
  if (!database) throw new Error('MongoDB connection is not ready.');

  const info = await database.admin().command({ buildInfo: 1 });
  const version = String(info.version || 'unknown');
  const major = Number(version.split('.')[0]);
  if (!Number.isFinite(major) || major < 8) {
    throw new Error(`MongoDB ${version} is unsupported; MongoDB 8.0 or newer is required.`);
  }

  await database.admin().command({ ping: 1 });
  logger.log(`MongoDB connection successful: ${connection.host}/${connection.name} (server ${version})`);
  if (version !== '8.0.26') {
    logger.warn(`MongoDB ${version} detected. This release was validated against MongoDB 8.0.26.`);
  }
  return { version, major };
}
