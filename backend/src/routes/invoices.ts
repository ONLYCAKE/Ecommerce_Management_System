import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { emailLimiter } from '../middleware/rateLimit';
import {
    getAllInvoices,
    getInvoiceByNo,
    createInvoice,
    updateInvoice,
    generateInvoicePdf,
    markComplete,
    getNextInvoiceNo,
    downloadInvoicePdf,
    sendInvoiceEmail,
    sendInvoiceReminder,
    bulkSendReminders,
    getInvoiceReminders,
    finalizeInvoice,
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

// status & actions
router.post('/mark-complete/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_UPDATE), markComplete);
router.post('/:invoiceNo/send-email', emailLimiter, requirePermission(PERMISSIONS.INVOICE_READ), sendInvoiceEmail);

// Reminder routes with email rate limiting
router.post('/:invoiceNo/send-reminder', emailLimiter, requirePermission(PERMISSIONS.INVOICE_READ), sendInvoiceReminder);
router.post('/bulk/send-reminders', emailLimiter, requirePermission(PERMISSIONS.INVOICE_READ), bulkSendReminders);
router.get('/:invoiceNo/reminders', requirePermission(PERMISSIONS.INVOICE_READ), getInvoiceReminders);

// Finalize draft invoice route
router.post('/:invoiceNo/finalize', requirePermission(PERMISSIONS.INVOICE_UPDATE), finalizeInvoice);

// GET single invoice must be last among invoiceNo routes to avoid shadowing other routes
router.get('/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_READ), getInvoiceByNo);

export default router;
