import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authenticate, roleCheck } from '../middleware/auth.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = Router();
router.use(authenticate);

// ✅ Get all buyers (search + sort)
router.get('/', roleCheck(PERMISSIONS.BUYER_READ), async (req, res) => {
  try {
    const { q = '' } = req.query;
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const buyers = await prisma.buyer.findMany({
      where,
      orderBy: { id: 'desc' },
    });

    res.json(buyers);
  } catch (err) {
    console.error('❌ Error fetching buyers:', err);
    res.status(500).json({ error: 'Failed to fetch buyers' });
  }
});

// ✅ Create buyer
router.post('/', roleCheck(PERMISSIONS.BUYER_CREATE), async (req, res) => {
  try {
    const buyer = await prisma.buyer.create({ data: req.body });
    res.status(201).json(buyer);
  } catch (err) {
    console.error('❌ Error creating buyer:', err);
    res.status(500).json({ error: 'Failed to create buyer' });
  }
});

// ✅ Update buyer
router.put('/:id', roleCheck(PERMISSIONS.BUYER_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const buyer = await prisma.buyer.update({
      where: { id },
      data: req.body,
    });
    res.json(buyer);
  } catch (err) {
    console.error('❌ Error updating buyer:', err);
    res.status(500).json({ error: 'Failed to update buyer' });
  }
});

// ✅ Delete buyer safely (now uses invoice model)
router.delete('/:id', roleCheck(PERMISSIONS.BUYER_DELETE), async (req, res) => {
  try {
    if (req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const id = Number(req.params.id);

    // Prevent deletion if linked invoices exist
    const invoiceCount = await prisma.invoice.count({ where: { buyerId: id } });
    if (invoiceCount > 0) {
      return res.status(400).json({
        message:
          'Cannot delete buyer while invoices exist. Reassign or delete related invoices first.',
      });
    }

    // ✅ Delete all invoices linked to this buyer (replaces prisma.order)
    await prisma.invoice.deleteMany({ where: { buyerId: id } });

    // ✅ Now delete buyer
    await prisma.buyer.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error deleting buyer:', err);
    res.status(500).json({ error: 'Failed to delete buyer' });
  }
});

export default router;
