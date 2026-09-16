import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import '../server/src/models/index.js';
import { ensureAllModelIndexes } from './lib/indexes.js';

try {
  await connectDatabase();
  await ensureAllModelIndexes(mongoose, { repairTextIndexes: true, repairKnownLegacyIndexes: true, logger: console });
  console.log('Production indexes repaired and verified successfully.');
} catch (error) {
  console.error('Production index repair failed:', error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
