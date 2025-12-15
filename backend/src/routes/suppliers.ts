import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { authenticate, roleCheck } from '../middleware/auth.ts';
import { PERMISSIONS } from '../constants/permissions.ts';

const router = Router();
router.use(authenticate);

router.get('/', roleCheck(PERMISSIONS.SUPPLIER_READ), async (req, res) => {
  const { q = '', sortBy = 'id', dir = 'desc', archived = 'false' } = req.query as any;

  const allowedSortFields = ['name', 'email', 'phone', 'id'];
  const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'id';
  const validDir = dir === 'asc' ? 'asc' : 'desc';
  const isArchived = archived === 'true';

  const where: any = { isArchived };
  if (q) {
    where.OR = [
      { name: { contains: q as string, mode: 'insensitive' } },
      { email: { contains: q as string, mode: 'insensitive' } }
    ];
  }

  const items = await prisma.supplier.findMany({
    where,
    orderBy: { [validSortBy]: validDir }
  });
  res.json(items);
});

router.post('/', roleCheck(PERMISSIONS.SUPPLIER_CREATE), async (req, res) => {
  const { name, email, phone, addressLine1, addressLine2, area, city, state, country, postalCode } = req.body as any;
  const item = await prisma.supplier.create({
    data: {
      name,
      email,
      phone,
      addressLine1: addressLine1 || '',
      addressLine2,
      area: area || '',
      city: city || '',
      state: state || '',
      country: country || '',
      postalCode: postalCode || ''
    }
  });
  res.status(201).json(item);
});

router.put('/:id', roleCheck(PERMISSIONS.SUPPLIER_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, phone, addressLine1, addressLine2, area, city, state, country, postalCode } = req.body as any;

    const item = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        addressLine1: addressLine1 || '',
        addressLine2: addressLine2 || '',
        area: area || '',
        city: city || '',
        state: state || '',
        country: country || '',
        postalCode: postalCode || ''
      }
    });

    res.json(item);
  } catch (err) {
    console.error('❌ Error updating supplier:', err);
    res.status(500).json({ message: 'Failed to update supplier' });
  }
});

router.delete('/:id', roleCheck(PERMISSIONS.SUPPLIER_DELETE), async (req, res) => {
  const id = Number(req.params.id);
  try {
    // Soft delete - set isArchived to true
    await prisma.supplier.update({
      where: { id },
      data: { isArchived: true }
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('❌ Error archiving supplier:', err);
    return res.status(500).json({ message: 'Failed to archive supplier' });
  }
});

// Restore archived supplier
router.patch('/:id/restore', roleCheck(PERMISSIONS.SUPPLIER_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const supplier = await prisma.supplier.update({
      where: { id },
      data: { isArchived: false }
    });
    res.json(supplier);
  } catch (err) {
    console.error('❌ Error restoring supplier:', err);
    res.status(500).json({ error: 'Failed to restore supplier' });
  }
});

// Permanent delete supplier
router.delete('/:id/permanent', roleCheck(PERMISSIONS.SUPPLIER_DELETE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [invoiceCount, productCount] = await Promise.all([
      prisma.invoice.count({ where: { supplierId: id } }),
      prisma.product.count({ where: { supplierId: id } })
    ]);
    if (invoiceCount > 0 || productCount > 0) {
      return res.status(409).json({ message: 'Cannot delete supplier while related products or invoices exist. Remove/reassign them first.' });
    }
    await prisma.supplier.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return res.status(409).json({ message: 'Delete blocked due to existing references. Please remove related records first.' });
    }
    console.error('❌ Error permanently deleting supplier:', err);
    res.status(500).json({ message: 'Failed to permanently delete supplier' });
  }
});

export default router;
