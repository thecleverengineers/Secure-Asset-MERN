import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

// Only a SHA-256 digest is persisted.  The opaque cookie value is never
// recoverable from MongoDB, which keeps a database read from becoming a live
// browser credential.
const AuthSessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true, index: true, maxlength: 80 },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false, maxlength: 64 },
  previousTokenHash: { type: String, select: false, maxlength: 64 },
  previousTokenExpiresAt: { type: Date, select: false },
  createdAt: { type: Date, default: Date.now, index: true },
  lastUsedAt: { type: Date, default: Date.now, index: true },
  lastRenewedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  absoluteExpiresAt: { type: Date, required: true, index: true },
  revokedAt: { type: Date, default: null, index: true },
  revokedReason: { type: String, trim: true, maxlength: 120 },
  device: { type: String, trim: true, maxlength: 500 },
  ip: { type: String, trim: true, maxlength: 128 },
  rotation: { type: Number, default: 0, min: 0 },
}, { timestamps: true, minimize: false });

// MongoDB removes expired sessions without requiring a PM2 worker or an
// in-memory timer.  The server still checks both rolling and absolute limits
// on every request because TTL deletion is intentionally asynchronous.
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'auth_session_expiry_ttl' });
AuthSessionSchema.index({ user: 1, revokedAt: 1, lastUsedAt: -1 }, { name: 'auth_session_user_activity' });

export const AuthSession = models.AuthSession || model('AuthSession', AuthSessionSchema);
