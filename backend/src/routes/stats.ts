import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { authenticate } from '../middleware/auth.ts';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  try {
    const [users, suppliers, buyers, products, draftCount, completedCount] = await Promise.all([
      prisma.user.count({ where: { isArchived: false } }).catch(() => 0),
      prisma.supplier.count().catch(() => 0),
      prisma.buyer.count().catch(() => 0),
      prisma.product.count().catch(() => 0),
      prisma.invoice.count({ where: { status: 'Processing' } }).catch(() => 0), // Changed from 'Draft' to 'Processing'
      prisma.invoice.count({ where: { status: 'Completed' } }).catch(() => 0),
    ]);

    const completed = await prisma.invoice.findMany({ where: { status: 'Completed' }, select: { id: true, total: true, createdAt: true }, orderBy: { createdAt: 'desc' as const }, take: 500 });

    const now = new Date();
    const months: Array<{ key: string; year: number; month: number; total: number; }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, year: d.getFullYear(), month: d.getMonth(), total: 0 });
    }
    const byKey = new Map(months.map(m => [m.key, m] as const));
    for (const inv of completed) {
      const d = inv.createdAt as Date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (byKey.has(key)) (byKey.get(key) as any).total += Number(inv.total || 0);
    }
    const revenueByMonth = months.map(m => ({ label: m.key, total: m.total }));

    const recentOrders = await prisma.invoice.findMany({ where: { status: 'Completed' }, include: { buyer: true, supplier: true }, orderBy: { createdAt: 'desc' as const }, take: 5 });

    const recentProducts = await prisma.product.findMany({ include: { supplier: true }, orderBy: { createdAt: 'desc' as const }, take: 10 });

    res.json({ totals: { users, suppliers, buyers, products }, invoices: { draft: draftCount, completed: completedCount }, revenueByMonth, recentOrders, recentProducts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

export default router;
