import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { isKnownInvalidReferencePlaceholder } from './lib/migration-safety.js';

const tenantKycFields = ['governmentId', 'addressProof', 'profilePhoto', 'selfie', 'employmentProof', 'reviewer'];

function isBsonObjectId(value) {
  return value instanceof mongoose.Types.ObjectId || value?._bsontype === 'ObjectId';
}

await connectDatabase();
try {
  const collection = mongoose.connection.db.collection('tenantkycs');
  const cursor = collection.find({}, { projection: Object.fromEntries(tenantKycFields.map((field) => [field, 1])) });
  let repairedDocuments = 0;
  const unsafe = [];

  for await (const document of cursor) {
    const unset = {};
    for (const field of tenantKycFields) {
      const value = document[field];
      if (value === undefined || value === null || isBsonObjectId(value)) continue;
      if (isKnownInvalidReferencePlaceholder(value)) unset[field] = '';
      else unsafe.push({ id: String(document._id), field, value: String(value).slice(0, 120) });
    }
    if (Object.keys(unset).length) {
      await collection.updateOne({ _id: document._id }, { $unset: unset });
      repairedDocuments += 1;
    }
  }

  if (unsafe.length) {
    const preview = unsafe.slice(0, 20).map((entry) => `${entry.id}.${entry.field}=${JSON.stringify(entry.value)}`).join('\n- ');
    throw new Error(`Unsafe non-ObjectId KYC references require manual review:\n- ${preview}${unsafe.length > 20 ? `\n...and ${unsafe.length - 20} more` : ''}`);
  }

  console.log(`Legacy ObjectId placeholder repair passed (${repairedDocuments} tenant KYC document(s) repaired).`);
} finally {
  await disconnectDatabase();
}
