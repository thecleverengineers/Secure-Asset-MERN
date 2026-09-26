import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { acceptRentalPayment, rejectRentalPayment, submitRentalInvoicePayment } from '../controllers/rentalPaymentController.js';

const router = Router();
router.use(authenticate);
router.post('/invoices/:invoiceId/payment', submitRentalInvoicePayment);
router.post('/payments/:paymentId/accept', acceptRentalPayment);
router.post('/payments/:paymentId/reject', rejectRentalPayment);

export default router;
