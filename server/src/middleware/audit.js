import { AuditLog } from '../models/index.js';

export async function writeAudit(req, { action, module, recordId, previousValue, updatedValue }) {
  try {
    await AuditLog.create({
      user: req.user?._id, role: req.user?.role, action, module, recordId,
      ip: req.ip, device: req.headers['user-agent'], previousValue, updatedValue,
    });
  } catch (error) { console.error('Audit write failed:', error.message); }
}
