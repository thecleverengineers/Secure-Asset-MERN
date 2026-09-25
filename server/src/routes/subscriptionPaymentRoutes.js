import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireAnyFeaturePermission, requireTenantSubscriptionAccount } from '../middleware/rolePermission.js';
import { approveManualSubscriptionOrder, approveManualSubscriptionPayment, cancelRazorpaySubscriptionPayment, createRazorpaySubscriptionOrder, listPendingSubscriptionPayments, paymentConfiguration, rejectManualSubscriptionOrder, rejectManualSubscriptionPayment, streamSubscriptionPaymentProof, verifyRazorpaySubscriptionPayment } from '../controllers/subscriptionPaymentController.js';

const router = Router();
router.use(authenticate);
router.get('/config', requireAnyFeaturePermission(['module:subscription', 'module:surveyor-subscription']), paymentConfiguration);
router.post('/razorpay/order', requireAnyFeaturePermission(['module:subscription', 'module:surveyor-subscription']), requireTenantSubscriptionAccount, createRazorpaySubscriptionOrder);
router.post('/razorpay/verify', requireAnyFeaturePermission(['module:subscription', 'module:surveyor-subscription']), requireTenantSubscriptionAccount, verifyRazorpaySubscriptionPayment);
router.post('/razorpay/cancel', requireAnyFeaturePermission(['module:subscription', 'module:surveyor-subscription']), requireTenantSubscriptionAccount, cancelRazorpaySubscriptionPayment);
router.get('/admin', authorize('admin'), listPendingSubscriptionPayments);
router.get('/admin/:id/proof', authorize('admin'), streamSubscriptionPaymentProof);
router.post('/admin/:id/approve', authorize('admin'), approveManualSubscriptionPayment);
router.post('/admin/subscription/:id/approve', authorize('admin'), approveManualSubscriptionOrder);
router.post('/admin/subscription/:id/reject', authorize('admin'), rejectManualSubscriptionOrder);
router.post('/admin/:id/reject', authorize('admin'), rejectManualSubscriptionPayment);
export default router;
