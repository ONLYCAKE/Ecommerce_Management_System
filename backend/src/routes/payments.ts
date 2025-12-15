import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import {
    createPayment,
    updatePayment,
    deletePayment,
    getPaymentsByInvoice
} from '../controllers/paymentController';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate);

// Payment CRUD operations
router.post('/', requirePermission(PERMISSIONS.INVOICE_UPDATE), createPayment);
router.put('/:id', requirePermission(PERMISSIONS.INVOICE_UPDATE), updatePayment);
router.delete('/:id', requirePermission(PERMISSIONS.INVOICE_UPDATE), deletePayment);

// Get payments for a specific invoice
router.get('/invoice/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_READ), getPaymentsByInvoice);

export default router;
