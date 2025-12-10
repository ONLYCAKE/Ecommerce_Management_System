import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { authenticate, roleCheck } from '../middleware/auth.ts';
import { PERMISSIONS } from '../constants/permissions.ts';

const router = Router();
router.use(authenticate);

router.get('/', roleCheck(PERMISSIONS.BUYER_READ), async (req, res) => {
  try {
    const { q = '', sortBy = 'id', dir = 'desc' } = req.query as any;

    const allowedSortFields = ['name', 'email', 'phone', 'id'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'id';
    const validDir = dir === 'asc' ? 'asc' : 'desc';

    const where = q
      ? { OR: [{ name: { contains: q as string, mode: 'insensitive' } }, { email: { contains: q as string, mode: 'insensitive' } }] }
      : {};

    const buyers = await prisma.buyer.findMany({
      where: where as any,
      orderBy: { [validSortBy]: validDir }
    });
    res.json(buyers);
  } catch (err) {
    console.error('❌ Error fetching buyers:', err);
    res.status(500).json({ error: 'Failed to fetch buyers' });
  }
});

router.post('/', roleCheck(PERMISSIONS.BUYER_CREATE), async (req, res) => {
  try {
    const { name, email, phone, gstin, addressLine1, addressLine2, area, city, state, country, postalCode } = req.body as any;
    const buyer = await prisma.buyer.create({
      data: {
        name,
        email,
        phone,
        gstin: gstin || null,
        addressLine1: addressLine1 || '',
        addressLine2,
        area: area || '',
        city: city || '',
        state: state || '',
        country: country || '',
        postalCode: postalCode || ''
      }
    });
    res.status(201).json(buyer);
  } catch (err) {
    console.error('❌ Error creating buyer:', err);
    res.status(500).json({ error: 'Failed to create buyer' });
  }
});

router.put('/:id', roleCheck(PERMISSIONS.BUYER_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const buyer = await prisma.buyer.update({ where: { id }, data: req.body as any });
    res.json(buyer);
  } catch (err) {
    console.error('❌ Error updating buyer:', err);
    res.status(500).json({ error: 'Failed to update buyer' });
  }
});

router.delete('/:id', roleCheck(PERMISSIONS.BUYER_DELETE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const invoiceCount = await prisma.invoice.count({ where: { buyerId: id } });
    if (invoiceCount > 0) {
      return res.status(409).json({ message: 'Cannot delete buyer while related invoices exist. Remove/reassign them first.' });
    }
    await prisma.buyer.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return res.status(409).json({ message: 'Delete blocked due to existing references. Please remove related records first.' });
    }
    console.error('❌ Error deleting buyer:', err);
    res.status(500).json({ error: 'Failed to delete buyer' });
  }
});

export default router;
