import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = Router();
router.use(authenticate);

// List invoices (orders)
router.get('/', requirePermission(PERMISSIONS.INVOICE_READ), async (req, res) => {
  const items = await prisma.invoice.findMany({
    where: { status: 'Completed' },
    include: { buyer: true, supplier: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(items);
});

// Get invoice by invoiceNo for preview
router.get('/:invoiceNo', requirePermission(PERMISSIONS.INVOICE_READ), async (req, res) => {
  const { invoiceNo } = req.params;
  const item = await prisma.invoice.findUnique({ where: { invoiceNo }, include: { buyer: true, supplier: true, items: { include: { product: true } } } });
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json(item);
});

// Create invoice
router.post('/', requirePermission(PERMISSIONS.INVOICE_CREATE), async (req, res) => {
  const { invoiceNo, buyerId, supplierId, paymentMethod = 'Cash', status = 'Draft', items = [] } = req.body;
  const normalized = items.filter(it => (it.title || it.productId) && Number(it.qty) > 0).map(it => ({
    productId: it.productId ? Number(it.productId) : null,
    title: it.title || '',
    description: it.description || null,
    qty: Number(it.qty) || 1,
    price: Number(it.price) || 0,
    gst: Number(it.gst) || 0,
    amount: (Number(it.price)||0) * (Number(it.qty)||1) * (1 + (Number(it.gst)||0)/100)
  }));
  const total = normalized.reduce((s,it)=> s + it.amount, 0);
  const created = await prisma.invoice.create({
    data: { invoiceNo, buyerId: Number(buyerId), supplierId: Number(supplierId), paymentMethod, status, total, items: { create: normalized } },
    include: { items: true }
  });
  res.status(201).json(created);
});

// Update invoice by id
router.put('/:id', requirePermission(PERMISSIONS.INVOICE_UPDATE), async (req, res) => {
  const id = Number(req.params.id);
  const { buyerId, supplierId, paymentMethod, status, items } = req.body;
  try {
    // Recompute total if items provided
    let totalPatch = {};
    if (Array.isArray(items)) {
      const normalized = items.filter(it => (it.title || it.productId) && Number(it.qty) > 0).map(it => ({
        productId: it.productId ? Number(it.productId) : null,
        title: it.title || '',
        description: it.description || null,
        qty: Number(it.qty) || 1,
        price: Number(it.price) || 0,
        gst: Number(it.gst) || 0,
        amount: (Number(it.price)||0) * (Number(it.qty)||1) * (1 + (Number(it.gst)||0)/100)
      }));
      const total = normalized.reduce((s,it)=> s + it.amount, 0);
      // replace items
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await prisma.invoice.update({ where: { id }, data: { items: { create: normalized } } });
      totalPatch = { total };
    }
    const updated = await prisma.invoice.update({ where: { id }, data: { ...(buyerId?{buyerId:Number(buyerId)}:{}), ...(supplierId?{supplierId:Number(supplierId)}:{}), ...(paymentMethod?{paymentMethod}:{}), ...(status?{status}:{}), ...totalPatch }, include: { items: true } });
    res.json(updated);
  } catch (e) {
    res.status(404).json({ message: 'Not found' });
  }
});

// Delete invoice by id
router.delete('/:id', requirePermission(PERMISSIONS.INVOICE_DELETE), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
  await prisma.invoice.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
