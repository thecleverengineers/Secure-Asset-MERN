import { Router } from 'express';
import multer from 'multer';
import { getPublicSite, getAppConfiguration, submitSiteEnquiry, getPublicPropertyStructure } from '../controllers/siteController.js';
import { getPersistentBrandAsset, uploadPersistentBrandAsset, uploadSiteAsset } from '../controllers/siteAssetController.js';
import { authenticate } from '../middleware/auth.js';
import { secureMultipartLimits } from '../middleware/uploadSecurity.js';

const router = Router();
const imageUpload = multer({ storage: multer.memoryStorage(), limits: secureMultipartLimits({ fileSize: 8 * 1024 * 1024, fields: 4 }) });
router.get('/config', getPublicSite);
router.get('/brand-assets/:slot', getPersistentBrandAsset);
router.get('/app-config', authenticate, getAppConfiguration);
router.post('/enquiries', submitSiteEnquiry);
router.get('/properties/:id/structure', getPublicPropertyStructure);
router.post('/admin-assets', authenticate, imageUpload.single('file'), uploadSiteAsset);
router.post('/admin-brand-assets/:slot', authenticate, imageUpload.single('file'), uploadPersistentBrandAsset);
export default router;
