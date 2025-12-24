import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { authenticate, roleCheck } from '../middleware/auth.ts';
import { PERMISSIONS } from '../constants/permissions.ts';

const router = Router();
router.use(authenticate);

router.get('/', roleCheck(PERMISSIONS.BUYER_READ), async (req, res) => {
  try {
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

    const buyers = await prisma.buyer.findMany({
      where,
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
        gstin: (gstin && gstin.trim()) ? gstin.trim() : null,
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
    res.status(500).json({ error: 'Failed to create buyer', message: (err as any).message });
  }
});

router.put('/:id', roleCheck(PERMISSIONS.BUYER_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { gstin, ...restData } = req.body as any;
    const buyer = await prisma.buyer.update({
      where: { id },
      data: {
        ...restData,
        gstin: (gstin && gstin.trim()) ? gstin.trim() : null
      }
    });
    res.json(buyer);
  } catch (err) {
    console.error('❌ Error updating buyer:', err);
    res.status(500).json({ error: 'Failed to update buyer', message: (err as any).message });
  }
});

router.delete('/:id', roleCheck(PERMISSIONS.BUYER_DELETE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    // Soft delete - set isArchived to true
    await prisma.buyer.update({
      where: { id },
      data: { isArchived: true }
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('❌ Error archiving buyer:', err);
    res.status(500).json({ error: 'Failed to archive buyer' });
  }
});

// Restore archived buyer
router.patch('/:id/restore', roleCheck(PERMISSIONS.BUYER_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const buyer = await prisma.buyer.update({
      where: { id },
      data: { isArchived: false }
    });
    res.json(buyer);
  } catch (err) {
    console.error('❌ Error restoring buyer:', err);
    res.status(500).json({ error: 'Failed to restore buyer' });
  }
});

// Permanent delete buyer
router.delete('/:id/permanent', roleCheck(PERMISSIONS.BUYER_DELETE), async (req, res) => {
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
    console.error('❌ Error permanently deleting buyer:', err);
    res.status(500).json({ error: 'Failed to permanently delete buyer' });
  }
});

export default router;
