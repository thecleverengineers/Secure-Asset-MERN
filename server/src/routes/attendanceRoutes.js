import { Router } from 'express';
import { authenticate, authorizeSurveyorMode } from '../middleware/auth.js';
import { checkIn, checkOut } from '../controllers/attendanceController.js';
const router = Router();
router.post('/check-in', authenticate, authorizeSurveyorMode, checkIn);
router.post('/check-out', authenticate, authorizeSurveyorMode, checkOut);
export default router;
