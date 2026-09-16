import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { globalSearch } from '../controllers/searchController.js';
const router = Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
router.get('/', authenticate, limiter, globalSearch);
export default router;
