import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../constants/permissions';
import {
  getAllProformas,
  getProformaById,
  createProforma,
  updateProforma,
  deleteProforma,
  generateProformaPdf,
  convertProformaToInvoice,
} from '../controllers/proformaController';

const router = Router();
router.use(authenticate);

// List & create
router.get('/', requirePermission(PERMISSIONS.INVOICE_READ), getAllProformas);
router.post('/', requirePermission(PERMISSIONS.INVOICE_CREATE), createProforma);

// PDF and convert
router.get('/:id/pdf', requirePermission(PERMISSIONS.INVOICE_READ), generateProformaPdf);
router.post('/:id/convert', requirePermission(PERMISSIONS.INVOICE_CREATE), convertProformaToInvoice);

// Detail & update/delete
router.get('/:id', requirePermission(PERMISSIONS.INVOICE_READ), getProformaById);
router.put('/:id', requirePermission(PERMISSIONS.INVOICE_UPDATE), updateProforma);
router.delete('/:id', requirePermission(PERMISSIONS.INVOICE_UPDATE), deleteProforma);

export default router;
