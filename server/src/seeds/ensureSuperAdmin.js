import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { User } from '../models/index.js';
import { ensurePersonalDrive } from '../services/driveService.js';
import { normalizeEmail } from '../utils/identity.js';

const email = normalizeEmail(process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || '');
if (!email) throw new Error('BOOTSTRAP_SUPER_ADMIN_EMAIL is required');

await connectDatabase();
try {
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new Error(`No existing user found for ${email}. Create the account first, then run seed:super-admin.`);
  user.role = 'super_admin';
  user.adminScope = 'global';
  user.status = 'active';
  user.kycStatus = 'verified';
  user.superAdminSecurity = { twoFactorRequired: true, criticalActionReauth: true, trustedDevicesOnly: false };
  await user.save({ validateModifiedOnly: true });
  await ensurePersonalDrive(user._id);
  console.log(`Super Admin enabled: ${email}`);
} finally {
  await disconnectDatabase();
}
