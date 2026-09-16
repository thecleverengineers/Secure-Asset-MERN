import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { User } from '../server/src/models/index.js';
import { identifierDescriptor, normalizeEmail, normalizeIndianMobile } from '../server/src/utils/identity.js';

async function verifyUser(user) {
  const email = normalizeEmail(user.email);
  const mobile = user.phone ? normalizeIndianMobile(user.phone) : null;
  if (user.emailNormalized !== email) throw new Error(`User ${user._id} has an unmapped email login identifier.`);
  if (mobile && user.phoneNormalized !== mobile) throw new Error(`User ${user._id} has an unmapped mobile login identifier.`);

  const emailMatch = await User.findOne(identifierDescriptor(email).query).select('_id').lean();
  if (!emailMatch || String(emailMatch._id) !== String(user._id)) throw new Error(`Email login lookup does not resolve user ${user._id}.`);

  if (mobile) {
    for (const format of [mobile, `+91${mobile}`, `91${mobile}`, `0${mobile}`]) {
      const match = await User.findOne(identifierDescriptor(format).query).select('_id').lean();
      if (!match || String(match._id) !== String(user._id)) throw new Error(`Mobile login format ${format} does not resolve user ${user._id}.`);
    }
  }
}

await connectDatabase();
try {
  const users = await User.find({}).select('+emailNormalized +phoneNormalized').lean();
  for (const user of users) await verifyUser(user);
  console.log(`Authentication database mapping passed for ${users.length} user account(s): email and mobile login identifiers resolve consistently.`);
} catch (error) {
  console.error('Authentication database mapping failed:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
