import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { addWishlist, listWishlist, removeWishlist, syncWishlist } from '../controllers/wishlistController.js';

const router = Router();
router.use(authenticate, authorize('tenant'));
router.get('/', listWishlist);
router.post('/', addWishlist);
router.post('/sync', syncWishlist);
router.delete('/:listingId', removeWishlist);

export default router;
