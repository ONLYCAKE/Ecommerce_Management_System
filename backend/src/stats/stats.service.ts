import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Matching backend-v2 routes/stats.ts getDateRange helper
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
            endDate.setDate(0);
            break;
        case 'quarter':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate, endDate };
}

@Injectable()
export class StatsService {
    constructor(private prisma: PrismaService) { }

    // Matching backend-v2 routes/stats.ts GET / (lines 41-146)
    async getStats(period: string = 'month') {
        const { startDate, endDate } = getDateRange(period);

        const [users, suppliers, buyers, products, draftCount] = await Promise.all([
            this.prisma.user.count({ where: { isArchived: false } }).catch(() => 0),
            this.prisma.supplier.count().catch(() => 0),
            this.prisma.buyer.count().catch(() => 0),
            this.prisma.product.count().catch(() => 0),
            this.prisma.invoice.count({ where: { status: 'Draft' } }).catch(() => 0),
        ]);

        // Get all non-draft invoices with payments
        const allInvoices = await this.prisma.invoice.findMany({
            where: { status: { notIn: ['Draft'] } },
            include: { payments: true },
        });

        // Calculate completed count
        const completedInvoices = allInvoices.filter((inv: any) => {
            const receivedAmount = inv.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
            return receivedAmount >= inv.total;
        });
        const completedCount = completedInvoices.length;

        // Calculate total sales for the selected period
        const periodInvoices = await this.prisma.invoice.findMany({
            where: {
                status: { notIn: ['Draft'] },
                createdAt: { gte: startDate, lte: endDate },
            },
        });
        const totalSales = periodInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

        // Revenue by month (last 12 months)
        const now = new Date();
        const months: Array<{ key: string; year: number; month: number; total: number }> = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.push({ key, year: d.getFullYear(), month: d.getMonth(), total: 0 });
        }
        const byKey = new Map(months.map((m) => [m.key, m] as const));

        for (const inv of completedInvoices as any[]) {
            const d = inv.createdAt as Date;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (byKey.has(key)) (byKey.get(key) as any).total += Number(inv.total || 0);
        }
        const revenueByMonth = months.map((m) => ({ label: m.key, total: m.total }));

        // Today's stats
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const [todayInvoices, todayPayments] = await Promise.all([
            this.prisma.invoice.count({
                where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { notIn: ['Draft'] } },
            }),
            this.prisma.payment.aggregate({
                where: { createdAt: { gte: todayStart, lte: todayEnd } },
                _sum: { amount: true },
                _count: true,
            }),
        ]);

        const todayStats = {
            invoicesCreated: todayInvoices,
            paymentsReceived: todayPayments._count || 0,
            amountReceived: todayPayments._sum.amount || 0,
        };

        // Recent products
        const recentProducts = await this.prisma.product.findMany({
            include: { supplier: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        return {
            totals: { users, suppliers, buyers, products },
            invoices: { draft: draftCount, completed: completedCount },
            revenueByMonth,
            recentProducts,
            totalSales,
            todayStats,
            period,
        };
    }
}
