import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireFeaturePermission } from '../middleware/rolePermission.js';
import { overview, myProperties, myPropertyRentCycle } from '../controllers/dashboardController.js';
const router = Router();
router.get('/overview', authenticate, requireFeaturePermission('module:dashboard'), overview);
router.get('/my-properties', authenticate, myProperties);
router.get('/my-properties/:tenancyId/rent-cycle', authenticate, myPropertyRentCycle);
export default router;
