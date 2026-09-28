import mongoose from 'mongoose';
import {
  User, Property, Application, Payment, Approval, AuditLog, Complaint, Subscription,
  RentalInvoice, Tenancy, TenantKyc, SurveyorVerification, NotificationDelivery,
} from '../models/index.js';
import { AuthSession } from '../models/session.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

const DAY = 24 * 60 * 60 * 1000;
const ADMIN_ROLES = ['super_admin', 'admin', 'manager'];
const ACCOUNT_ROLES = ['super_admin', 'admin', 'manager', 'landlord', 'tenant', 'user', 'surveyor'];

function databaseStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
}

async function paymentTotals(match = {}) {
  const [row] = await Payment.aggregate([
    { $match: match },
    { $group: {
      _id: null,
      amount: { $sum: { $cond: [{ $gt: ['$paidAmount', 0] }, '$paidAmount', { $ifNull: ['$amount', 0] }] } },
      count: { $sum: 1 },
    } },
  ]);
  return { amount: Number(row?.amount || 0), count: Number(row?.count || 0) };
}

async function invoiceTotals(match = {}) {
  const [row] = await RentalInvoice.aggregate([
    { $match: match },
    { $group: {
      _id: null,
      amount: { $sum: { $ifNull: ['$balanceAmount', 0] } },
      count: { $sum: 1 },
    } },
  ]);
  return { amount: Number(row?.amount || 0), count: Number(row?.count || 0) };
}

function publicUser(user) {
  const data = typeof user?.toObject === 'function' ? user.toObject() : { ...(user || {}) };
  delete data.password;
  delete data.refreshTokens;
  delete data.emailNormalized;
  delete data.phoneNormalized;
  delete data.otpHash;
  delete data.otpExpiresAt;
  delete data.passwordResetTokenHash;
  return data;
}

export const overview = asyncHandler(async (_req, res) => {
  const now = new Date();
  const dayStart = new Date(now.getTime() - DAY);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers, activeUsers, roleBreakdown, totalProperties, pendingProperties, activeTenancies,
    pendingApplications, openComplaints, pendingKyc, pendingSurveyors, pendingApprovals,
    activeSubscriptions, monthlyRevenue, outstandingRent, lockedUsers, suspendedUsers,
    activeSessions, failedNotifications, privilegedChanges, recentAudit,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: 'active' }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Property.countDocuments({ deletedAt: null }),
    Property.countDocuments({ 'publicListingApproval.status': 'pending', deletedAt: null }),
    Tenancy.countDocuments({ status: { $in: ['active', 'reserved', 'deposit_pending', 'agreement_pending', 'notice'] } }),
    Application.countDocuments({ status: { $in: ['submitted', 'under_review', 'shortlisted', 'additional_documents_requested', 'agreement_pending', 'deposit_pending'] } }),
    Complaint.countDocuments({ status: { $in: ['open', 'assigned', 'in_progress', 'awaiting_approval', 'reopened'] } }),
    TenantKyc.countDocuments({ status: { $in: ['submitted', 'under_review', 'pending', 'changes_required'] } }),
    SurveyorVerification.countDocuments({ status: { $in: ['submitted', 'under_review', 'pending', 'changes_required'] } }),
    Approval.countDocuments({ status: { $in: ['pending', 'submitted', 'under_review'] } }),
    Subscription.countDocuments({ status: 'active', $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }, { expiresAt: { $exists: false } }] }),
    paymentTotals({ status: 'paid', paidAt: { $gte: monthStart } }),
    invoiceTotals({ status: { $in: ['pending', 'partially_paid', 'overdue', 'failed'] } }),
    User.countDocuments({ status: 'locked' }),
    User.countDocuments({ status: 'suspended' }),
    AuthSession.countDocuments({ revokedAt: null, expiresAt: { $gt: now }, absoluteExpiresAt: { $gt: now } }),
    NotificationDelivery.countDocuments({ status: 'failed', createdAt: { $gte: dayStart } }),
    AuditLog.countDocuments({ createdAt: { $gte: dayStart }, $or: [{ severity: { $in: ['high', 'critical'] } }, { action: /role|permission|delete|restore|security|session/i }] }),
    AuditLog.find().sort({ createdAt: -1 }).limit(12).populate('user', 'name email role').lean(),
  ]);

  res.set('Cache-Control', 'private, no-store');
  res.json({
    success: true,
    data: {
      generatedAt: now,
      kpis: {
        totalUsers, activeUsers, totalProperties, activeTenancies, pendingApplications,
        monthlyRevenue: monthlyRevenue.amount, outstandingRent: outstandingRent.amount,
        pendingApprovals: pendingApprovals + pendingKyc + pendingSurveyors + pendingProperties,
        openComplaints, activeSubscriptions,
      },
      roleBreakdown: roleBreakdown.map((row) => ({ role: row._id || 'unknown', count: row.count })),
      approvals: {
        tenantKyc: pendingKyc, surveyors: pendingSurveyors, publicProperties: pendingProperties,
        generic: pendingApprovals, applications: pendingApplications,
      },
      security: {
        lockedUsers, suspendedUsers, activeSessions, failedNotifications24h: failedNotifications,
        privilegedChanges24h: privilegedChanges,
      },
      finance: {
        monthlyCollected: monthlyRevenue.amount,
        monthlyTransactions: monthlyRevenue.count,
        outstandingRent: outstandingRent.amount,
        outstandingInvoices: outstandingRent.count,
      },
      system: {
        api: 'operational',
        database: databaseStatus(),
        uptimeSeconds: Math.floor(process.uptime()),
        node: process.version,
        environment: process.env.NODE_ENV || 'development',
        memory: process.memoryUsage(),
      },
      recentAudit,
    },
  });
});

export const finance = asyncHandler(async (_req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const [monthly, yearly, outstanding, failed, refunds, recent] = await Promise.all([
    paymentTotals({ status: 'paid', paidAt: { $gte: monthStart } }),
    paymentTotals({ status: 'paid', paidAt: { $gte: yearStart } }),
    invoiceTotals({ status: { $in: ['pending', 'partially_paid', 'overdue', 'failed'] } }),
    Payment.countDocuments({ status: 'failed', createdAt: { $gte: monthStart } }),
    paymentTotals({ status: 'refunded', updatedAt: { $gte: yearStart } }),
    Payment.find().sort({ createdAt: -1 }).limit(25).populate('payer payee', 'name email role').lean(),
  ]);
  res.json({ success: true, data: { monthly, yearly, outstanding, failedThisMonth: failed, refundsYtd: refunds, recent } });
});

export const securityEvents = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
  const [events, lockedAccounts, sessions] = await Promise.all([
    AuditLog.find({
      $or: [
        { severity: { $in: ['high', 'critical'] } },
        { action: /login|password|role|permission|delete|restore|security|session|2fa/i },
      ],
    }).sort({ createdAt: -1 }).limit(limit).populate('user', 'name email role status').lean(),
    User.find({ status: { $in: ['locked', 'suspended'] } }).select('name email phone role status lastLogin updatedAt').sort({ updatedAt: -1 }).limit(50).lean(),
    AuthSession.find({ revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastUsedAt: -1 }).limit(100).populate('user', 'name email role').lean(),
  ]);
  res.json({ success: true, data: { events, lockedAccounts, sessions } });
});

export const systemHealth = asyncHandler(async (_req, res) => {
  const now = new Date();
  const [activeSessions, failedDeliveries, criticalEvents] = await Promise.all([
    AuthSession.countDocuments({ revokedAt: null, expiresAt: { $gt: now }, absoluteExpiresAt: { $gt: now } }),
    NotificationDelivery.countDocuments({ status: 'failed', createdAt: { $gte: new Date(now.getTime() - DAY) } }),
    AuditLog.countDocuments({ severity: 'critical', createdAt: { $gte: new Date(now.getTime() - DAY) } }),
  ]);
  const database = databaseStatus();
  res.json({
    success: true,
    data: {
      checkedAt: now,
      services: [
        { key: 'frontend-api', label: 'Secure Asset API', status: 'operational' },
        { key: 'database', label: 'MongoDB', status: database === 'connected' ? 'operational' : 'degraded', detail: database },
        { key: 'sessions', label: 'Authentication sessions', status: 'operational', detail: `${activeSessions} active` },
        { key: 'notifications', label: 'Notification delivery', status: failedDeliveries ? 'degraded' : 'operational', detail: `${failedDeliveries} failures / 24h` },
        { key: 'security', label: 'Security event monitor', status: criticalEvents ? 'degraded' : 'operational', detail: `${criticalEvents} critical events / 24h` },
      ],
      runtime: { uptimeSeconds: Math.floor(process.uptime()), node: process.version, environment: process.env.NODE_ENV || 'development', memory: process.memoryUsage() },
    },
  });
});

export const userOverview = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(422, 'Invalid user identifier');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  const id = user._id;
  const [properties, applications, payments, audit, sessions] = await Promise.all([
    Property.countDocuments({ $or: [{ owner: id }, { manager: id }], deletedAt: null }),
    Application.countDocuments({ $or: [{ applicant: id }, { landlord: id }] }),
    Payment.countDocuments({ $or: [{ payer: id }, { payee: id }] }),
    AuditLog.find({ user: id }).sort({ createdAt: -1 }).limit(30).lean(),
    AuthSession.find({ user: id }).sort({ lastUsedAt: -1 }).limit(20).lean(),
  ]);
  res.json({ success: true, data: { user: publicUser(user), summary: { properties, applications, payments, activeSessions: sessions.filter((item) => !item.revokedAt && item.expiresAt > new Date()).length }, audit, sessions } });
});

export const userAction = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(422, 'Invalid user identifier');
  const action = String(req.body?.action || '').trim().toLowerCase();
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 5) throw new ApiError(422, 'A clear audit reason of at least 5 characters is required');

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  const before = publicUser(user);
  const actingOnSelf = String(user._id) === String(req.user._id);
  let revokeSessions = false;
  let severity = 'high';

  if (action === 'suspend') {
    if (actingOnSelf && user.role === 'super_admin') throw new ApiError(409, 'The active Super Admin cannot suspend their own account');
    user.status = 'suspended'; revokeSessions = true;
  } else if (action === 'activate' || action === 'restore') {
    user.status = 'active';
  } else if (action === 'lock') {
    if (actingOnSelf && user.role === 'super_admin') throw new ApiError(409, 'The active Super Admin cannot lock their own account');
    user.status = 'locked'; revokeSessions = true;
  } else if (action === 'logout_all') {
    revokeSessions = true;
  } else if (action === 'set_role') {
    const nextRole = String(req.body?.role || '').trim().toLowerCase();
    if (!ACCOUNT_ROLES.includes(nextRole)) throw new ApiError(422, 'Unsupported account role');
    const touchesRootRole = user.role === 'super_admin' || nextRole === 'super_admin';
    if (touchesRootRole && String(req.body?.confirmation || '') !== 'SUPER_ADMIN') {
      throw new ApiError(422, 'Type SUPER_ADMIN to confirm a root-role change');
    }
    if (actingOnSelf && user.role === 'super_admin' && nextRole !== 'super_admin') {
      throw new ApiError(409, 'Use a separate Super Admin account for root ownership transfer before demoting this account');
    }
    user.role = nextRole;
    user.adminScope = nextRole === 'super_admin' ? 'global' : ADMIN_ROLES.includes(nextRole) ? 'assigned' : 'none';
    revokeSessions = true;
    severity = touchesRootRole ? 'critical' : 'high';
  } else {
    throw new ApiError(422, 'Unsupported Super Admin action');
  }

  if (action !== 'logout_all') await user.save({ validateModifiedOnly: true });
  if (revokeSessions) {
    await Promise.all([
      AuthSession.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: `super_admin:${action}` } }),
      User.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } }),
    ]);
  }

  await AuditLog.create({
    user: req.user._id,
    role: req.user.role,
    action: `super-admin:user:${action}`,
    module: 'super-admin',
    recordId: user._id,
    previousValue: before,
    updatedValue: publicUser(user),
    reason,
    requestId: req.id,
    severity,
    ip: req.ip,
    device: req.get('user-agent'),
    metadata: { targetUserId: String(user._id), targetRole: user.role, revokeSessions },
  });

  res.json({ success: true, data: publicUser(user), message: 'Super Admin action completed and added to the audit trail.' });
});
