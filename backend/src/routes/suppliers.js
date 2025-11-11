import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authenticate, roleCheck } from '../middleware/auth.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = Router();
router.use(authenticate);

router.get('/', roleCheck(PERMISSIONS.SUPPLIER_READ), async (req, res) => {
  const { q = '' } = req.query;
  const where = q ? { OR: [
    { name: { contains: q, mode: 'insensitive' } },
    { email: { contains: q, mode: 'insensitive' } }
  ] } : {};
  const items = await prisma.supplier.findMany({ where, orderBy: { id: 'desc' } });
  res.json(items);
});

router.post('/', roleCheck(PERMISSIONS.SUPPLIER_CREATE), async (req, res) => {
  const item = await prisma.supplier.create({ data: req.body });
  res.status(201).json(item);
});

router.put('/:id', roleCheck(PERMISSIONS.SUPPLIER_UPDATE), async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.supplier.update({ where: { id }, data: req.body });
  res.json(item);
});

router.delete('/:id', roleCheck(PERMISSIONS.SUPPLIER_DELETE), async (req, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ message: 'Forbidden' });
  const id = Number(req.params.id);
  // Do not allow delete if invoices reference this supplier
  const invoiceCount = await prisma.invoice.count({ where: { supplierId: id } });
  if (invoiceCount > 0) {
    return res.status(400).json({ message: 'Cannot delete supplier while invoices exist. Reassign or delete related invoices first.' });
  }
  await prisma.product.updateMany({ where: { supplierId: id }, data: { supplierId: null } });
  await prisma.supplier.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
