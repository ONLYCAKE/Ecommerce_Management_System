import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { authenticate, requirePermission } from '../middleware/auth.ts';
import { PERMISSIONS } from '../constants/permissions.ts';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.PRODUCT_READ), async (req, res) => {
  try {
    const { q = '', archived = 'false' } = req.query as any;
    const isArchived = archived === 'true';

    const where: any = { isArchived };
    if (q) {
      where.OR = [
        { title: { contains: q as string, mode: 'insensitive' } },
        { sku: { contains: q as string, mode: 'insensitive' } }
      ];
    }

    const items = await prisma.product.findMany({ where, include: { supplier: true }, orderBy: { createdAt: 'desc' as const } });
    res.json(items);
  } catch (err) {
    console.error('❌ Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post('/', requirePermission(PERMISSIONS.PRODUCT_CREATE), async (req, res) => {
  try {
    const dataIn = req.body as any;
    const supplierId = dataIn.supplierId && !isNaN(Number(dataIn.supplierId)) ? Number(dataIn.supplierId) : null;
    const price = Number(dataIn.price) || 0;
    const stock = Number(dataIn.stock) || 0;
    const taxType = dataIn.taxType || 'withTax';
    const taxRate = taxType === 'withTax' ? (Number(dataIn.taxRate) || 18) : 0;
    const data = {
      sku: dataIn.sku || null,
      title: dataIn.title?.trim(),
      description: dataIn.description || null,
      category: dataIn.category || null,
      price,
      stock,
      supplierId,
      hsnCode: dataIn.hsnCode || null,
      taxType,
      taxRate
    };
    const item = await prisma.product.create({ data: data as any });
    res.status(201).json(item);
  } catch (err) {
    console.error('❌ Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/:id', requirePermission(PERMISSIONS.PRODUCT_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const dataIn = req.body as any;
    const supplierId = dataIn.supplierId === null || dataIn.supplierId === '' ? null : !isNaN(Number(dataIn.supplierId)) ? Number(dataIn.supplierId) : null;
    const price = dataIn.price !== undefined && !isNaN(Number(dataIn.price)) ? Number(dataIn.price) : undefined;
    const stock = dataIn.stock !== undefined && !isNaN(Number(dataIn.stock)) ? Number(dataIn.stock) : undefined;
    const taxType = dataIn.taxType || undefined;
    const taxRate = taxType === 'withTax' ? (dataIn.taxRate !== undefined ? Number(dataIn.taxRate) : undefined) : (taxType === 'withoutTax' ? 0 : undefined);
    const data: any = {
      title: dataIn.title?.trim(),
      description: dataIn.description || null,
      category: dataIn.category || null,
      ...(price !== undefined && { price }),
      ...(stock !== undefined && { stock }),
      supplierId,
      hsnCode: dataIn.hsnCode || null,
      ...(taxType !== undefined && { taxType }),
      ...(taxRate !== undefined && { taxRate })
    };
    const item = await prisma.product.update({ where: { id }, data, include: { supplier: true } });
    res.json(item);
  } catch (err) {
    console.error('❌ Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/:id', requirePermission(PERMISSIONS.PRODUCT_DELETE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    // Soft delete - set isArchived to true
    await prisma.product.update({
      where: { id },
      data: { isArchived: true }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error archiving product:', err);
    res.status(500).json({ error: 'Failed to archive product' });
  }
});

// Restore archived product
router.patch('/:id/restore', requirePermission(PERMISSIONS.PRODUCT_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const product = await prisma.product.update({
      where: { id },
      data: { isArchived: false }
    });
    res.json(product);
  } catch (err) {
    console.error('❌ Error restoring product:', err);
    res.status(500).json({ error: 'Failed to restore product' });
  }
});

// Permanent delete product
router.delete('/:id/permanent', requirePermission(PERMISSIONS.PRODUCT_DELETE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.invoiceItem.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error permanently deleting product:', err);
    res.status(500).json({ error: 'Failed to permanently delete product' });
  }
});

export default router;
