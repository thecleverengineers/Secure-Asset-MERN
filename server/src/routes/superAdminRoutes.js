import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getSuperAdminOverview,
  listSuperAdmins,
  promoteSuperAdmin,
  demoteSuperAdmin,
  getSuperAdminSecurityEvents,
} from '../controllers/superAdminController.js';

const router = Router();
router.use(authenticate, authorize('super_admin'));
router.get('/overview', getSuperAdminOverview);
router.get('/users', listSuperAdmins);
router.post('/users/:userId/promote', promoteSuperAdmin);
router.post('/users/:userId/demote', demoteSuperAdmin);
router.get('/security-events', getSuperAdminSecurityEvents);

export default router;
