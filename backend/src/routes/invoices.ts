import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.ts';
import { getAllInvoices, getInvoiceByNo, createInvoice, updateInvoice, deleteInvoice, generateInvoicePdf, markComplete, getNextInvoiceNo, downloadInvoicePdf } from '../controllers/invoiceController.ts';
import { PERMISSIONS } from '../constants/permissions.ts';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.INVOICE_READ), getAllInvoices);
router.get('/next-no', requirePermission(PERMISSIONS.INVOICE_CREATE), getNextInvoiceNo);
router.get('/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_READ), getInvoiceByNo);
router.post('/', requirePermission(PERMISSIONS.INVOICE_CREATE), createInvoice);
router.put('/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_UPDATE), updateInvoice);
router.delete('/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_DELETE), deleteInvoice);
router.get('/generate/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_READ), generateInvoicePdf);
router.get('/:invoiceNo/download', requirePermission(PERMISSIONS.INVOICE_READ), downloadInvoicePdf);
router.post('/mark-complete/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_UPDATE), markComplete);

export default router;
