import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import '../server/src/models/index.js';
import { ensureAllModelIndexes } from './lib/indexes.js';

try {
  await connectDatabase();
  await ensureAllModelIndexes(mongoose, { repairTextIndexes: true, logger: console });
  console.log('Production indexes created successfully.');
} catch (error) {
  console.error('Index creation failed:', error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
