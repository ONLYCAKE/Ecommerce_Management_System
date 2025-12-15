import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { authenticate } from '../middleware/auth.ts';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  try {
    const [users, suppliers, buyers, products, draftCount] = await Promise.all([
      prisma.user.count({ where: { isArchived: false } }).catch(() => 0),
      prisma.supplier.count().catch(() => 0),
      prisma.buyer.count().catch(() => 0),
      prisma.product.count().catch(() => 0),
      prisma.invoice.count({ where: { status: 'Draft' } }).catch(() => 0),
    ]);

    // Get all invoices with payments to calculate completed count
    const allInvoices = await prisma.invoice.findMany({
      where: { status: { not: 'Cancelled' } },
      include: { payments: true }
    });

    // Calculate completed count (invoices where receivedAmount >= total)
    const completedInvoices = allInvoices.filter(inv => {
      const receivedAmount = inv.payments.reduce((sum, p) => sum + p.amount, 0);
      return receivedAmount >= inv.total;
    });
    const completedCount = completedInvoices.length;

    const now = new Date();
    const months: Array<{ key: string; year: number; month: number; total: number; }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, year: d.getFullYear(), month: d.getMonth(), total: 0 });
    }
    const byKey = new Map(months.map(m => [m.key, m] as const));
    for (const inv of completedInvoices) {
      const d = inv.createdAt as Date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (byKey.has(key)) (byKey.get(key) as any).total += Number(inv.total || 0);
    }
    const revenueByMonth = months.map(m => ({ label: m.key, total: m.total }));

    const recentOrders = await prisma.invoice.findMany({
      include: { buyer: true, supplier: true, payments: true },
      orderBy: { createdAt: 'desc' as const },
      take: 5
    }).then(invoices =>
      invoices.filter(inv => {
        const receivedAmount = inv.payments.reduce((sum, p) => sum + p.amount, 0);
        return receivedAmount >= inv.total;
      })
    );

    const recentProducts = await prisma.product.findMany({ include: { supplier: true }, orderBy: { createdAt: 'desc' as const }, take: 10 });

    res.json({ totals: { users, suppliers, buyers, products }, invoices: { draft: draftCount, completed: completedCount }, revenueByMonth, recentOrders, recentProducts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

export default router;
