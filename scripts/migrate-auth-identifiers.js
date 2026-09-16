import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { User } from '../server/src/models/index.js';
import { isPlausibleEmail, normalizeEmail, normalizeIndianMobile } from '../server/src/utils/identity.js';

function collectDuplicate(map, key, id) {
  const list = map.get(key) || [];
  list.push(String(id));
  map.set(key, list);
}

export function analyzeAuthIdentifiers(users) {
  const normalized = [];
  const invalid = [];
  const emails = new Map();
  const mobiles = new Map();

  for (const user of users) {
    const email = normalizeEmail(user.email);
    const phoneSource = user.phone === undefined || user.phone === null ? '' : String(user.phone).trim();
    const phone = phoneSource ? normalizeIndianMobile(phoneSource) : null;

    if (!isPlausibleEmail(email)) invalid.push({ id: String(user._id), field: 'email', value: String(user.email || '') });
    if (phoneSource && !phone) invalid.push({ id: String(user._id), field: 'phone', value: phoneSource });
    if (email) collectDuplicate(emails, email, user._id);
    if (phone) collectDuplicate(mobiles, phone, user._id);
    normalized.push({ id: user._id, email, phone });
  }

  const duplicateEmails = [...emails.entries()].filter(([, ids]) => ids.length > 1).map(([value, ids]) => ({ value, ids }));
  const duplicateMobiles = [...mobiles.entries()].filter(([, ids]) => ids.length > 1).map(([value, ids]) => ({ value, ids }));
  return { normalized, invalid, duplicateEmails, duplicateMobiles };
}

export async function migrateAuthIdentifiers({ logger = console } = {}) {
  const users = await User.collection.find({}, { projection: { _id: 1, email: 1, phone: 1 } }).toArray();
  const report = analyzeAuthIdentifiers(users);

  if (report.invalid.length) {
    const details = report.invalid.map((item) => `${item.field} on user ${item.id}`).join(', ');
    throw new Error(`Authentication identifier migration stopped because invalid legacy values were found: ${details}. Correct these records before deployment.`);
  }
  if (report.duplicateEmails.length || report.duplicateMobiles.length) {
    const details = [
      ...report.duplicateEmails.map((item) => `email ${item.value} -> ${item.ids.join(',')}`),
      ...report.duplicateMobiles.map((item) => `mobile ending ${item.value.slice(-4)} -> ${item.ids.join(',')}`),
    ].join('; ');
    throw new Error(`Authentication identifier migration stopped because multiple users resolve to the same login identifier: ${details}. Merge or correct the duplicate accounts before deployment.`);
  }

  const clearOperations = report.normalized.map((item) => ({
    updateOne: { filter: { _id: item.id }, update: { $unset: { emailNormalized: '', phoneNormalized: '' } } },
  }));
  const operations = report.normalized.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: item.phone
        ? { $set: { email: item.email, emailNormalized: item.email, phone: item.phone, phoneNormalized: item.phone } }
        : { $set: { email: item.email, emailNormalized: item.email }, $unset: { phone: '', phoneNormalized: '' } },
    },
  }));

  if (clearOperations.length) await User.collection.bulkWrite(clearOperations, { ordered: true });
  if (operations.length) await User.collection.bulkWrite(operations, { ordered: true });
  logger.log(`Authentication identifiers normalized for ${operations.length} user account(s).`);
  return { users: operations.length };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  await connectDatabase();
  try {
    await migrateAuthIdentifiers();
  } finally {
    await disconnectDatabase();
  }
}
