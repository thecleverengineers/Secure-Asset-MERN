import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth.js';
import { secureMultipartLimits } from '../middleware/uploadSecurity.js';
import {
  autocompletePlacesController,
  computeRouteMatrixController,
  computeRoutesController,
  createNavigationConnectTripController,
  elevationController,
  getMapsPlatformStatus,
  getNavigationConnectTripController,
  getPlaceDetailsController,
  groundingCallController,
  groundingToolsController,
  nearestRoadsController,
  optimizeToursController,
  publishStreetViewPhotoController,
  searchPlacesController,
  snapToRoadsController,
  speedLimitsController,
  validateAddressController,
} from '../controllers/googleMapsController.js';

const router = Router();
const requesterKey = (req) => req.user?._id ? `user:${String(req.user._id)}` : `ip:${String(req.ip || 'unknown')}`;
const serviceLimiter = rateLimit({ windowMs: 60 * 1000, limit: 90, keyGenerator: requesterKey, standardHeaders: true, legacyHeaders: false });
const expensiveLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, keyGenerator: requesterKey, standardHeaders: true, legacyHeaders: false });
const streetViewUpload = multer({ storage: multer.memoryStorage(), limits: secureMultipartLimits({ fileSize: 50 * 1024 * 1024, fields: 6, fieldSize: 16 * 1024 }) });

router.use(authenticate);
router.use((_req, res, next) => {
  // Coordinates, routes, place results and provider diagnostics are sensitive
  // operational data. Never let a browser, proxy, or shared cache retain them.
  res.set('Cache-Control', 'private, no-store');
  next();
});
router.get('/status', authorize('admin'), getMapsPlatformStatus);
router.post('/routes', serviceLimiter, computeRoutesController);
router.post('/route-matrix', expensiveLimiter, computeRouteMatrixController);
router.post('/address-validation', serviceLimiter, validateAddressController);
router.post('/places/autocomplete', serviceLimiter, autocompletePlacesController);
router.get('/places/:placeId', serviceLimiter, getPlaceDetailsController);
router.post('/places/search', serviceLimiter, searchPlacesController);
router.post('/elevation', serviceLimiter, elevationController);
router.post('/roads/snap', serviceLimiter, snapToRoadsController);
router.post('/roads/nearest', serviceLimiter, nearestRoadsController);
router.post('/roads/speed-limits', serviceLimiter, speedLimitsController);
router.get('/navigation-connect/trip', serviceLimiter, getNavigationConnectTripController);
router.post('/navigation-connect/trips', serviceLimiter, createNavigationConnectTripController);
router.post('/route-optimization', expensiveLimiter, authorize('admin'), optimizeToursController);
router.get('/grounding-lite/tools', expensiveLimiter, authorize('admin'), groundingToolsController);
router.post('/grounding-lite/call', expensiveLimiter, authorize('admin'), groundingCallController);
router.post('/street-view/publish', expensiveLimiter, authorize('admin'), streetViewUpload.single('file'), publishStreetViewPhotoController);

export default router;
