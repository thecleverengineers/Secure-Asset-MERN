import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireFeaturePermission, requireTenantSubscriptionAccount } from '../middleware/rolePermission.js';
import {
  listPlans, mySubscription, checkout, changePlan, renew, cancel, switchMode,
  getVerification, saveVerification, submitVerification, reviewVerification,
  createOrUpdateProfile, setProfileVisibility, createPrivateShareLink, revokePrivateShareLink,
  dashboard, acceptQuotation, finalizeReport,
} from '../controllers/surveyorSubscriptionController.js';
import { syncFieldData, performCalculation, approveCalculation, exportGeoJson, exportKml } from '../controllers/surveyorFieldController.js';
import { exportSurveyReport } from '../controllers/surveyReportExportController.js';
import { createSurveyInvoice, paySurveyInvoice } from '../controllers/surveyorFinanceController.js';

const router = Router();
router.get('/plans', listPlans);
router.use(authenticate, requireFeaturePermission('module:surveyor-subscription'));
router.get('/me', requireTenantSubscriptionAccount, mySubscription);
router.post('/checkout', requireTenantSubscriptionAccount, checkout);
router.post('/change-plan', requireTenantSubscriptionAccount, changePlan);
router.post('/renew', requireTenantSubscriptionAccount, renew);
router.post('/:id/cancel', requireTenantSubscriptionAccount, cancel);
router.post('/mode', requireTenantSubscriptionAccount, switchMode);
router.get('/verification', getVerification);
router.put('/verification', saveVerification);
router.post('/verification/submit', submitVerification);
router.post('/verification/:id/review', authorize('admin'), reviewVerification);
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
