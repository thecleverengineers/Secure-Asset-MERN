import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  mongoose.set('strictQuery', true);

  // Do not enable Mongoose's global sanitizeFilter option here. That option
  // rewrites trusted application filters such as { expiresAt: { $gt: now } }
  // and { status: { $in: [...] } } into $eq expressions, which breaks normal
  // date/range queries and email/mobile identifier lookups. SecureAsset blocks
  // MongoDB operator injection at the HTTP boundary in rejectUnsafeObjectKeys,
  // while all database filters are assembled server-side from allow-listed
  // fields.
  mongoose.set('sanitizeFilter', false);

  await mongoose.connect(env.MONGODB_URI, {
    appName: 'SecureAsset',
    autoIndex: false,
    maxPoolSize: env.NODE_ENV === 'production' ? 20 : 10,
    minPoolSize: env.NODE_ENV === 'production' ? 2 : 0,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    heartbeatFrequencyMS: 10_000,
  });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
