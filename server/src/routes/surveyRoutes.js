import { Router } from 'express';
import { authenticate, authorizeSurveyorMode } from '../middleware/auth.js';
import { requireFeaturePermission } from '../middleware/rolePermission.js';
import { syncSurveys } from '../controllers/surveySyncController.js';
const router = Router();
router.post('/sync', authenticate, requireFeaturePermission('module:surveys', 'edit'), authorizeSurveyorMode, syncSurveys);
export default router;
