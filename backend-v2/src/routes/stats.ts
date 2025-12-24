import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.ts';
import { authenticate } from '../middleware/auth.ts';

const router = Router();
router.use(authenticate);

// Helper to get date range based on period
function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);

  switch (period) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'lastMonth':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate.setDate(0); // Last day of previous month
      break;
    case 'quarter':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Default to this month
  }

  return { startDate, endDate };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'month';
    const { startDate, endDate } = getDateRange(period);

    const [users, suppliers, buyers, products, draftCount] = await Promise.all([
      prisma.user.count({ where: { isArchived: false } }).catch(() => 0),
      prisma.supplier.count().catch(() => 0),
      prisma.buyer.count().catch(() => 0),
      prisma.product.count().catch(() => 0),
      prisma.invoice.count({ where: { status: 'Draft' } }).catch(() => 0),
    ]);

    // Get all non-draft invoices with payments
    const allInvoices = await prisma.invoice.findMany({
      where: {
        status: { notIn: ['Draft'] } // Exclude Draft, include Paid, Partial, Unpaid
      },
      include: { payments: true }
    });

    // Calculate completed count (invoices where receivedAmount >= total)
    const completedInvoices = allInvoices.filter(inv => {
      const receivedAmount = inv.payments.reduce((sum, p) => sum + p.amount, 0);
      return receivedAmount >= inv.total;
    });
    const completedCount = completedInvoices.length;

    // Calculate total sales for the selected period (from actual invoices, excluding Draft)
    const periodInvoices = await prisma.invoice.findMany({
      where: {
        status: { notIn: ['Draft'] },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });
    const totalSales = periodInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

    // Revenue by month (last 12 months) - from completed invoices only
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

    // Today's stats for daybook
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayInvoices, todayPayments] = await Promise.all([
      prisma.invoice.count({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          status: { notIn: ['Draft'] }
        }
      }),
      prisma.payment.aggregate({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd }
        },
        _sum: { amount: true },
        _count: true
      })
    ]);

    const todayStats = {
      invoicesCreated: todayInvoices,
      paymentsReceived: todayPayments._count || 0,
      amountReceived: todayPayments._sum.amount || 0
    };

    // Recent products
    const recentProducts = await prisma.product.findMany({
      include: { supplier: true },
      orderBy: { createdAt: 'desc' as const },
      take: 10
    });

    res.json({
      totals: { users, suppliers, buyers, products },
      invoices: { draft: draftCount, completed: completedCount },
      revenueByMonth,
      recentProducts,
      totalSales,
      todayStats,
      period
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

export default router;
