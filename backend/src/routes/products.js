import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = Router();
router.use(authenticate);

// ✅ GET all products with search
router.get('/', requirePermission(PERMISSIONS.PRODUCT_READ), async (req, res) => {
  try {
    const { q = '' } = req.query;
    const where = q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const items = await prisma.product.findMany({
      where,
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(items);
  } catch (err) {
    console.error('❌ Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ✅ CREATE product
router.post('/', requirePermission(PERMISSIONS.PRODUCT_CREATE), async (req, res) => {
  try {
    const dataIn = req.body;

    const supplierId =
      dataIn.supplierId && !isNaN(Number(dataIn.supplierId))
        ? Number(dataIn.supplierId)
        : null;

    const price = Number(dataIn.price) || 0;
    const stock = Number(dataIn.stock) || 0;

    const data = {
      sku: dataIn.sku || null,
      title: dataIn.title?.trim(),
      description: dataIn.description || null,
      category: dataIn.category || null,
      price,
      stock,
      supplierId,
    };

    const item = await prisma.product.create({ data });
    res.status(201).json(item);
  } catch (err) {
    console.error('❌ Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// ✅ UPDATE product
router.put('/:id', requirePermission(PERMISSIONS.PRODUCT_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const dataIn = req.body;

    const supplierId =
      dataIn.supplierId === null || dataIn.supplierId === ''
        ? null
        : !isNaN(Number(dataIn.supplierId))
        ? Number(dataIn.supplierId)
        : null;

    const price =
      dataIn.price !== undefined && !isNaN(Number(dataIn.price))
        ? Number(dataIn.price)
        : undefined;

    const stock =
      dataIn.stock !== undefined && !isNaN(Number(dataIn.stock))
        ? Number(dataIn.stock)
        : undefined;

    const data = {
      title: dataIn.title?.trim(),
      description: dataIn.description || null,
      category: dataIn.category || null,
      ...(price !== undefined && { price }),
      ...(stock !== undefined && { stock }),
      supplierId,
    };

    const item = await prisma.product.update({
      where: { id },
      data,
      include: { supplier: true },
    });

    res.json(item);
  } catch (err) {
    console.error('❌ Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ✅ DELETE product (with related invoice cleanup)
router.delete('/:id', requirePermission(PERMISSIONS.PRODUCT_DELETE), async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Delete related invoice items first
    await prisma.invoiceItem.deleteMany({ where: { productId: id } });

    await prisma.product.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
