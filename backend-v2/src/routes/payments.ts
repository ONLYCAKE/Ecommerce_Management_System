import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { paymentLimiter } from '../middleware/rateLimit';
import {
    createPayment,
    updatePayment,
    deletePayment,
    getPaymentsByInvoice,
    getAllPaymentRecords
} from '../controllers/paymentController';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate);

// Get all payment records (for Payment Records tab)
router.get('/records', requirePermission(PERMISSIONS.INVOICE_READ), getAllPaymentRecords);

// Get payments for a specific invoice
router.get('/invoice/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_READ), getPaymentsByInvoice);

// Payment CRUD operations with rate limiting
router.post('/', paymentLimiter, requirePermission(PERMISSIONS.INVOICE_UPDATE), createPayment);
router.put('/:id', paymentLimiter, requirePermission(PERMISSIONS.INVOICE_UPDATE), updatePayment);
router.delete('/:id', paymentLimiter, requirePermission(PERMISSIONS.INVOICE_UPDATE), deletePayment);

export default router;
