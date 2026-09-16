import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { User } from '../models/index.js';
import { ensurePersonalDrive } from '../services/driveService.js';
import { identifierDescriptor, normalizeEmail, normalizeIndianMobile } from '../utils/identity.js';

const admin = {
  name: process.env.BOOTSTRAP_ADMIN_NAME || 'Clever Engineers',
  email: normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL || 'thecleverengineers@gmail.com'),
  phone: normalizeIndianMobile(process.env.BOOTSTRAP_ADMIN_MOBILE || '9707949651'),
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Kites@123',
};

if (!admin.phone) throw new Error('BOOTSTRAP_ADMIN_MOBILE must be a valid Indian mobile number');

await connectDatabase();
try {
  // Resolve the bootstrap identity in deterministic order. A previous
  // deployment can have left the bootstrap email and mobile on two different
  // records; querying both identifiers inside one `$or` can select the phone
  // record and then collide with the existing unique email on save.
  const emailUser = await User.findOne(identifierDescriptor(admin.email).query).select('+password');
  const phoneUser = await User.findOne(identifierDescriptor(admin.phone).query).select('+password');
  let user = emailUser || phoneUser;
  const created = !user;
  if (!user) user = new User({ password: admin.password });
  user.name = admin.name;
  user.email = admin.email;
  if (!phoneUser || String(phoneUser._id) === String(user._id)) {
    user.phone = admin.phone;
  } else {
    console.warn(`Bootstrap mobile ${admin.phone} is already used by another account; preserving that account and keeping the administrator's existing mobile.`);
  }
  user.role = 'admin';
  user.status = 'active';
  user.mobileVerifiedAt ||= new Date();
  user.kycStatus = 'verified';
  if (!created && process.env.RESET_BOOTSTRAP_ADMIN_PASSWORD === 'YES') user.password = admin.password;
  await user.save();
  await ensurePersonalDrive(user._id);
  console.log(created ? `Admin created: ${admin.email}` : `Admin verified: ${admin.email}`);
  if (created) console.log('Change the bootstrap admin password immediately after the first successful login.');
} finally {
  await disconnectDatabase();
}
