import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { finance, overview, securityEvents, systemHealth, userAction, userOverview } from '../controllers/superAdminController.js';

const router = Router();
router.use(authenticate, authorize('super_admin'));

router.get('/overview', overview);
router.get('/finance', finance);
router.get('/security-events', securityEvents);
router.get('/system-health', systemHealth);
router.get('/users/:id/overview', userOverview);
router.post('/users/:id/actions', userAction);

export default router;
