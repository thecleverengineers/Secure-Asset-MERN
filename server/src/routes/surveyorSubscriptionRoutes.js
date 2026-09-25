import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireFeaturePermission, requireTenantSubscriptionAccount } from '../middleware/rolePermission.js';
import {
  listPlans, mySubscription, checkout, changePlan, renew, cancel, switchMode,
  getVerification, requestVerificationMobileOtp, verifyVerificationMobileOtp, saveVerification, submitVerification, reviewVerification,
  createOrUpdateProfile, setProfileVisibility, createPrivateShareLink, revokePrivateShareLink,
  dashboard, acceptQuotation, finalizeReport,
} from '../controllers/surveyorSubscriptionController.js';
import { syncFieldData, performCalculation, approveCalculation, exportGeoJson, exportKml } from '../controllers/surveyorFieldController.js';
import { exportSurveyReport } from '../controllers/surveyReportExportController.js';
import { uploadSurveyorProfileAsset, uploadSurveyorVerificationAsset } from '../controllers/siteAssetController.js';
import { secureMultipartLimits } from '../middleware/uploadSecurity.js';
import { createSurveyInvoice, paySurveyInvoice } from '../controllers/surveyorFinanceController.js';

const router = Router();
const verificationImageUpload = multer({ storage: multer.memoryStorage(), limits: secureMultipartLimits({ fileSize: 8 * 1024 * 1024, fields: 4 }) });
const verificationOtpRequestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const verificationOtpVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
router.get('/plans', listPlans);
router.use(authenticate, requireFeaturePermission('module:surveyor-subscription'));
router.get('/me', requireTenantSubscriptionAccount, mySubscription);
router.post('/checkout', requireTenantSubscriptionAccount, checkout);
router.post('/change-plan', requireTenantSubscriptionAccount, changePlan);
router.post('/renew', requireTenantSubscriptionAccount, renew);
router.post('/:id/cancel', requireTenantSubscriptionAccount, cancel);
router.post('/mode', requireTenantSubscriptionAccount, switchMode);
router.get('/verification', getVerification);
router.post('/verification/mobile-otp/request', verificationOtpRequestLimiter, requestVerificationMobileOtp);
router.post('/verification/mobile-otp/verify', verificationOtpVerifyLimiter, verifyVerificationMobileOtp);
router.post('/verification/assets', verificationImageUpload.single('file'), uploadSurveyorVerificationAsset);
router.put('/verification', saveVerification);
router.post('/verification/submit', submitVerification);
router.post('/verification/:id/review', authorize('admin'), reviewVerification);
router.post('/profile/assets', verificationImageUpload.single('file'), uploadSurveyorProfileAsset);
router.put('/profile', createOrUpdateProfile);
router.post('/profile/visibility', setProfileVisibility);
router.post('/profile/share-link', createPrivateShareLink);
router.delete('/profile/share-link', revokePrivateShareLink);
router.get('/dashboard', dashboard);
router.post('/quotations/:id/accept', acceptQuotation);
router.post('/projects/:projectId/invoices', createSurveyInvoice);
router.post('/invoices/:id/pay', paySurveyInvoice);
router.post('/reports/:id/finalize', finalizeReport);
router.get('/reports/:id/export', exportSurveyReport);
router.post('/field-data/sync', syncFieldData);
router.post('/field-data/:id/calculate', performCalculation);
router.post('/field-data/:id/calculations/:calculationId/approve', approveCalculation);
router.get('/projects/:projectId/geojson', exportGeoJson);
router.get('/projects/:projectId/kml', exportKml);
export default router;
