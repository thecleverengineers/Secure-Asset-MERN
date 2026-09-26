import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { acceptRentalPayment, downloadRentalPaymentReceipt, getRentalPaymentProof, listLandlordTransactions, rejectRentalPayment, submitRentalInvoicePayment } from '../controllers/rentalPaymentController.js';

const router = Router();
router.use(authenticate);
router.get('/landlord-transactions', listLandlordTransactions);
router.post('/invoices/:invoiceId/payment', submitRentalInvoicePayment);
router.get('/payments/:paymentId/proof', getRentalPaymentProof);
router.get('/payments/:paymentId/receipt', downloadRentalPaymentReceipt);
router.post('/payments/:paymentId/accept', acceptRentalPayment);
router.post('/payments/:paymentId/reject', rejectRentalPayment);

export default router;
