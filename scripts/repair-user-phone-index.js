import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { User } from '../server/src/models/index.js';
import { repairUserPhoneIndex } from './lib/user-phone-index.js';

try {
  await connectDatabase();
  const result = await repairUserPhoneIndex(User.collection, { logger: console });
  console.log(`User phone index preflight passed (${result.action}).`);
} catch (error) {
  console.error('User phone index preflight failed:', error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
