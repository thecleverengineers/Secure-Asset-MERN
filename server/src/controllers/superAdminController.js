import mongoose from 'mongoose';
import {
  User, Property, Tenant, Payment, Approval, Complaint, AuditLog,
  NotificationDelivery, Subscription,
} from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

const recentSince = (hours = 24) => new Date(Date.now() - hours * 60 * 60 * 1000);

export const getSuperAdminOverview = asyncHandler(async (_req, res) => {
  const now = new Date();
  const [
    users, activeUsers, landlords, tenants, surveyors, superAdmins,
    properties, pendingProperties, tenancies, pendingApprovals,
    openComplaints, subscriptions, activeSubscriptions, failedNotifications,
    recentSecurityEvents, paymentAgg,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ $or: [{ role: 'landlord' }, { landlordEnabled: true }] }),
    User.countDocuments({ role: { $in: ['tenant', 'user'] } }),
    User.countDocuments({ $or: [{ role: 'surveyor' }, { surveyorEnabled: true }] }),
    User.countDocuments({ role: 'super_admin', status: 'active' }),
    Property.countDocuments({ deletedAt: null }),
    Property.countDocuments({ deletedAt: null, $or: [{ status: 'pending_approval' }, { 'publicListingApproval.status': 'pending' }] }),
    Tenant.countDocuments({ status: { $in: ['active', 'occupied', 'current'] } }),
    Approval.countDocuments({ status: { $in: ['pending', 'escalated', 'returned'] } }),
    Complaint.countDocuments({ status: { $in: ['open', 'assigned', 'in_progress', 'awaiting_approval', 'reopened'] } }),
    Subscription.countDocuments({}),
    Subscription.countDocuments({ status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }),
    NotificationDelivery.countDocuments({ status: 'failed' }),
    AuditLog.countDocuments({ createdAt: { $gte: recentSince(24) }, action: { $regex: /(login|permission|role|security|delete|restore|reset|suspend|lock)/i } }),
    Payment.aggregate([
      { $match: { status: { $in: ['paid', 'partial', 'pending', 'overdue'] } } },
      { $group: { _id: '$status', total: { $sum: '$amount' }, paid: { $sum: '$paidAmount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const payments = Object.fromEntries(paymentAgg.map((row) => [row._id, { total: row.total || 0, paid: row.paid || 0, count: row.count || 0 }]));
  res.json({
    success: true,
    data: {
      generatedAt: now.toISOString(),
      users: { total: users, active: activeUsers, landlords, tenants, surveyors, superAdmins },
      property: { total: properties, pendingApproval: pendingProperties },
      operations: { activeTenancies: tenancies, pendingApprovals, openComplaints },
      subscriptions: { total: subscriptions, active: activeSubscriptions },
      communications: { failedNotifications },
      security: { recentEvents24h: recentSecurityEvents, database: mongoose.connection.readyState === 1 ? 'operational' : 'degraded' },
      payments,
      runtime: { uptimeSeconds: Math.round(process.uptime()), node: process.versions.node, memory: process.memoryUsage() },
    },
  });
});

export const listSuperAdmins = asyncHandler(async (_req, res) => {
  const data = await User.find({ role: 'super_admin' })
    .select('name email phone status adminScope superAdminSecurity lastLogin createdAt updatedAt')
    .sort({ createdAt: 1 })
    .lean();
  res.json({ success: true, data });
});

export const promoteSuperAdmin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role === 'super_admin') return res.json({ success: true, data: user, message: 'User is already a Super Admin' });
  const previousValue = { role: user.role, adminScope: user.adminScope, status: user.status };
  user.role = 'super_admin';
  user.adminScope = 'global';
  user.status = 'active';
  user.superAdminSecurity = {
    twoFactorRequired: true,
    criticalActionReauth: true,
    trustedDevicesOnly: Boolean(user.superAdminSecurity?.trustedDevicesOnly),
  };
  await user.save({ validateModifiedOnly: true });
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'super-admin:promoted', module: 'super-admin',
    recordId: user._id, previousValue, updatedValue: { role: user.role, adminScope: user.adminScope },
    ip: req.ip, device: req.get('user-agent'),
  });
  res.json({ success: true, data: user, message: 'Super Admin access granted' });
});

export const demoteSuperAdmin = asyncHandler(async (req, res) => {
  if (String(req.user._id) === String(req.params.userId)) throw new ApiError(409, 'You cannot demote your own Super Admin account');
  const user = await User.findById(req.params.userId);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role !== 'super_admin') throw new ApiError(409, 'User is not a Super Admin');
  const activeCount = await User.countDocuments({ role: 'super_admin', status: 'active' });
  if (activeCount <= 1) throw new ApiError(409, 'At least one active Super Admin must remain');
  const previousValue = { role: user.role, adminScope: user.adminScope };
  user.role = 'admin';
  user.adminScope = 'global';
  await user.save({ validateModifiedOnly: true });
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'super-admin:demoted', module: 'super-admin',
    recordId: user._id, previousValue, updatedValue: { role: user.role, adminScope: user.adminScope },
    ip: req.ip, device: req.get('user-agent'),
  });
  res.json({ success: true, data: user, message: 'Super Admin access removed; user remains an Admin' });
});

export const getSuperAdminSecurityEvents = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const [audit, lockedUsers] = await Promise.all([
    AuditLog.find({ action: { $regex: /(login|permission|role|security|delete|restore|reset|suspend|lock|backup)/i } })
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    User.find({ status: { $in: ['locked', 'suspended'] } }).select('name email role status updatedAt').sort({ updatedAt: -1 }).limit(50).lean(),
  ]);
  res.json({ success: true, data: { audit, lockedUsers } });
});
