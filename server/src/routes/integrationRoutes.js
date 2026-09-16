import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth.js';
import { getFast2SmsSettings, updateFast2SmsSettings, testFast2SmsSettings, getRazorpaySettings, updateRazorpaySettings, getMapsSettings, updateMapsSettings } from '../controllers/integrationController.js';

const router = Router();
const testLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
router.use(authenticate, authorize('admin'));
router.get('/fast2sms', getFast2SmsSettings);
router.patch('/fast2sms', updateFast2SmsSettings);
router.post('/fast2sms/test', testLimiter, testFast2SmsSettings);
router.get('/razorpay', getRazorpaySettings);
router.patch('/razorpay', updateRazorpaySettings);
router.get('/maps', getMapsSettings);
router.patch('/maps', updateMapsSettings);
export default router;
