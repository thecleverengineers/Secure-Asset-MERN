import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireFeaturePermission } from '../middleware/rolePermission.js';
import { acceptRentalPayment, rejectRentalPayment, submitRentalInvoicePayment } from '../controllers/rentalPaymentController.js';

const router = Router();
router.use(authenticate, requireFeaturePermission('module:rental-invoices'));
router.post('/invoices/:invoiceId/payment', submitRentalInvoicePayment);
router.post('/payments/:paymentId/accept', acceptRentalPayment);
router.post('/payments/:paymentId/reject', rejectRentalPayment);

export default router;
