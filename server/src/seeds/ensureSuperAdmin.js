import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { User } from '../models/index.js';
import { ensurePersonalDrive } from '../services/driveService.js';
import { normalizeEmail, normalizeIndianMobile } from '../utils/identity.js';

const name = String(process.env.SUPER_ADMIN_NAME || 'Secure Asset Super Admin').trim();
const email = normalizeEmail(process.env.SUPER_ADMIN_EMAIL || '');
const password = String(process.env.SUPER_ADMIN_PASSWORD || '');
const rawMobile = String(process.env.SUPER_ADMIN_MOBILE || '').trim();
const mobile = rawMobile ? normalizeIndianMobile(rawMobile) : undefined;

if (!email) throw new Error('SUPER_ADMIN_EMAIL is required');
if (password && password.length < 12) throw new Error('SUPER_ADMIN_PASSWORD must contain at least 12 characters');
if (rawMobile && !mobile) throw new Error('SUPER_ADMIN_MOBILE must be a valid Indian mobile number');

await connectDatabase();
try {
  let user = await User.findOne({ emailNormalized: email }).select('+password');
  const created = !user;
  if (!user) {
    if (!password) throw new Error('SUPER_ADMIN_PASSWORD is required when creating the Super Admin account');
    user = new User({ name, email, password });
  }

  user.name = name || user.name;
  user.email = email;
  if (mobile) user.phone = mobile;
  user.role = 'super_admin';
  user.adminScope = 'global';
  user.status = 'active';
  user.kycStatus = 'verified';
  user.mobileVerifiedAt ||= mobile ? new Date() : user.mobileVerifiedAt;
  user.superAdminSecurity = {
    twoFactorRequired: true,
    criticalActionReauth: true,
    trustedDevicesOnly: Boolean(user.superAdminSecurity?.trustedDevicesOnly),
  };

  if (!created && process.env.RESET_SUPER_ADMIN_PASSWORD === 'YES') {
    if (!password) throw new Error('SUPER_ADMIN_PASSWORD is required when RESET_SUPER_ADMIN_PASSWORD=YES');
    user.password = password;
  }

  await user.save();
  await ensurePersonalDrive(user._id);
  console.log(created ? `Super Admin created: ${email}` : `Super Admin verified: ${email}`);
  console.log('Enable two-factor authentication immediately and keep this account for privileged administration only.');
} finally {
  await disconnectDatabase();
}
