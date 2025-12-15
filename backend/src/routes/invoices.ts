import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import {
    getAllInvoices,
    getInvoiceByNo,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    generateInvoicePdf,
    markComplete,
    getNextInvoiceNo,
    downloadInvoicePdf,
    sendInvoiceEmail,
    sendInvoiceReminder,
    bulkSendReminders,
    getInvoiceReminders,
    cancelInvoice,
    getInvoiceSummary
} from '../controllers/invoiceController';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate);

// list & meta
router.get('/', requirePermission(PERMISSIONS.INVOICE_READ), getAllInvoices);
router.get('/next-no', requirePermission(PERMISSIONS.INVOICE_CREATE), getNextInvoiceNo);
router.get('/summary', requirePermission(PERMISSIONS.INVOICE_READ), getInvoiceSummary);

// PDF & download (explicit routes placed BEFORE the dynamic :invoiceNo route)
router.get('/generate/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_READ), generateInvoicePdf);
router.get('/:invoiceNo/download', requirePermission(PERMISSIONS.INVOICE_READ), downloadInvoicePdf);

// invoice operations (explicit routes)
router.post('/', requirePermission(PERMISSIONS.INVOICE_CREATE), createInvoice);
router.put('/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_UPDATE), updateInvoice);
router.delete('/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_DELETE), deleteInvoice);

// status & actions
router.post('/mark-complete/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_UPDATE), markComplete);
router.post('/:invoiceNo/send-email', requirePermission(PERMISSIONS.INVOICE_READ), sendInvoiceEmail);

// Reminder routes
router.post('/:invoiceNo/send-reminder', requirePermission(PERMISSIONS.INVOICE_READ), sendInvoiceReminder);
router.post('/bulk/send-reminders', requirePermission(PERMISSIONS.INVOICE_READ), bulkSendReminders);
router.get('/:invoiceNo/reminders', requirePermission(PERMISSIONS.INVOICE_READ), getInvoiceReminders);

// Cancel route
router.patch('/:invoiceNo/cancel', requirePermission(PERMISSIONS.INVOICE_UPDATE), cancelInvoice);

// GET single invoice must be last among invoiceNo routes to avoid shadowing other routes
router.get('/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_READ), getInvoiceByNo);

export default router;
