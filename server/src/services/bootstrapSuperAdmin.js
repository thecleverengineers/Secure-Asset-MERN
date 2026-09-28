import { User } from '../models/index.js';
import { ensurePersonalDrive } from './driveService.js';
import { normalizeEmail } from '../utils/identity.js';

export async function ensureBootstrapSuperAdmin() {
  const enabled = String(process.env.BOOTSTRAP_SUPER_ADMIN_ENABLED || '').trim().toLowerCase();
  if (!['1', 'true', 'yes', 'on'].includes(enabled)) return { applied: false, reason: 'disabled' };

  const email = normalizeEmail(process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || '');
  const password = String(process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD || '');
  const name = String(process.env.BOOTSTRAP_SUPER_ADMIN_NAME || 'Secure Asset Super Admin').trim() || 'Secure Asset Super Admin';

  if (!email) throw new Error('BOOTSTRAP_SUPER_ADMIN_EMAIL is required when bootstrap is enabled');

  let user = await User.findOne({ email }).select('+password');
  const created = !user;
  const resetPassword = String(process.env.RESET_BOOTSTRAP_SUPER_ADMIN_PASSWORD || '').toUpperCase() === 'YES';
  if ((created || resetPassword) && password.length < 8) throw new Error('BOOTSTRAP_SUPER_ADMIN_PASSWORD must contain at least 8 characters when creating or resetting a Super Admin');

  if (!user) {
    user = new User({
      name,
      email,
      password,
      role: 'super_admin',
      adminScope: 'global',
      status: 'active',
      kycStatus: 'verified',
      superAdminSecurity: {
        twoFactorRequired: true,
        criticalActionReauth: true,
        trustedDevicesOnly: false,
      },
    });
  } else {
    user.name ||= name;
    user.role = 'super_admin';
    user.adminScope = 'global';
    user.status = 'active';
    user.kycStatus = 'verified';
    user.superAdminSecurity = {
      twoFactorRequired: true,
      criticalActionReauth: true,
      trustedDevicesOnly: Boolean(user.superAdminSecurity?.trustedDevicesOnly),
    };
    if (resetPassword) user.password = password;
  }

  await user.save();
  await ensurePersonalDrive(user._id);
  console.log(created ? `Bootstrap Super Admin created: ${email}` : `Bootstrap Super Admin verified: ${email}`);
  return { applied: true, created, userId: String(user._id), email };
}
