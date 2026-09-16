import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createSystemBackup, getBackupRecoveryOverview, listSystemBackups, requestSystemRestore,
} from '../controllers/backupRecoveryController.js';

const router = Router();
const createLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const restoreLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 4, standardHeaders: true, legacyHeaders: false });

router.use(authenticate, authorize('admin'));
router.get('/overview', getBackupRecoveryOverview);
router.get('/backups', listSystemBackups);
router.post('/backups', createLimiter, createSystemBackup);
router.post('/backups/:backupId/restore-request', restoreLimiter, requestSystemRestore);

export default router;
