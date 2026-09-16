import mongoose from 'mongoose';
import { AuthSession, AuditLog, User } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { revokeAllServerSessions, revokeSessionForUser } from '../services/serverSession.js';

function activeFilter() {
  const now = new Date();
  return { revokedAt: null, expiresAt: { $gt: now }, absoluteExpiresAt: { $gt: now } };
}

function userSummary(user) {
  return user ? { _id: user._id, name: user.name, email: user.email, role: user.role, status: user.status } : null;
}

export const listAdminSessions = asyncHandler(async (req, res) => {
  const requested = Number(req.query.limit || 100);
  const limit = Number.isInteger(requested) ? Math.min(200, Math.max(1, requested)) : 100;
  const records = await AuthSession.find(activeFilter())
    .sort({ lastUsedAt: -1, createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email role status')
    .lean()
    .exec();
  res.json({ success: true, data: records.map((record) => ({
    id: record.sessionId,
    device: record.device || 'Unknown device',
    ip: record.ip || '',
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    expiresAt: record.expiresAt,
    absoluteExpiresAt: record.absoluteExpiresAt,
    rotation: Number(record.rotation || 0),
    user: userSummary(record.user),
  })) });
});

export const revokeAdminSession = asyncHandler(async (req, res) => {
  const record = await AuthSession.findOne({ sessionId: req.params.sessionId }).select('user').lean().exec();
  if (!record) throw new ApiError(404, 'Session not found');
  const revoked = await revokeSessionForUser(record.user, req.params.sessionId, 'admin_revoked');
  if (!revoked) throw new ApiError(404, 'Session is already inactive');
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'admin:session_revoked', module: 'auth', recordId: record.user, updatedValue: { sessionId: req.params.sessionId }, ip: req.ip, device: req.get('user-agent') });
  res.json({ success: true, message: 'Session revoked by administrator' });
});

export const revokeAdminUserSessions = asyncHandler(async (req, res) => {
  const userId = String(req.params.userId || '');
  if (!mongoose.Types.ObjectId.isValid(userId)) throw new ApiError(422, 'User id is invalid');
  const target = await User.findById(userId).select('_id name email').lean().exec();
  if (!target) throw new ApiError(404, 'User not found');
  await revokeAllServerSessions(target._id, 'admin_user_revoked');
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'admin:user_sessions_revoked', module: 'auth', recordId: target._id, updatedValue: { userId: target._id }, ip: req.ip, device: req.get('user-agent') });
  res.json({ success: true, message: `All sessions for ${target.name || target.email} were revoked` });
});
