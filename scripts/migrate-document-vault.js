import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import mongoose from 'mongoose';
import { User, DriveFile, DriveFolder } from '../server/src/models/index.js';
import { ensurePersonalDrive, createLegalTemplateFolders, recalculateUsage } from '../server/src/services/driveService.js';
import { ensureAllModelIndexes } from './lib/indexes.js';
await connectDatabase();

async function removeLegacyTtl(Model) {
  const indexes = await Model.collection.indexes().catch(() => []);
  for (const index of indexes) {
    if (index.key?.purgeAt === 1 && index.expireAfterSeconds !== undefined) {
      await Model.collection.dropIndex(index.name);
      console.log(`Removed unsafe legacy TTL index ${Model.modelName}.${index.name}`);
    }
  }
}
await removeLegacyTtl(DriveFile);
await removeLegacyTtl(DriveFolder);
await ensureAllModelIndexes(mongoose, { repairTextIndexes: true, logger: console });
const cursor = User.find({ status: { $ne: 'suspended' } }).cursor();
let count = 0;
for await (const user of cursor) {
  await ensurePersonalDrive(user._id);
  await createLegalTemplateFolders(user);
  await recalculateUsage(user._id);
  count += 1;
  if (count % 100 === 0) console.log(`Migrated ${count} users`);
}
console.log(`Document Vault migration complete for ${count} users.`);
await disconnectDatabase();
