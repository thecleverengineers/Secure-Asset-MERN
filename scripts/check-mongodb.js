import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { verifyMongoCompatibility } from './lib/database-health.js';

dotenv.config();
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/secureasset';

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 7000, connectTimeoutMS: 7000 });
  await verifyMongoCompatibility(mongoose.connection);
  await mongoose.disconnect();
} catch (error) {
  console.error('MongoDB connection or compatibility check failed.');
  console.error(error?.message || error);
  console.error('\nStart MongoDB 8 Community Server or update MONGODB_URI in .env.');
  process.exit(1);
}
