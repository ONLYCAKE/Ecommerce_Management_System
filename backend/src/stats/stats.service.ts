import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ==========================================
 * REVENUE CALCULATION RULES (Single Source of Truth)
 * ==========================================
 * 
 * DEFINITIONS:
 * - Total Revenue = Sum of invoice totals for PAID invoices only
 *   (PAID = invoice where received payments >= invoice total)
 * - Received Amount = Sum of all payments for PAID invoices
 * - An invoice is PAID when: payments.sum >= invoice.total
 * 
 * RULES:
 * 1. Total Revenue >= Received Amount (always)
 * 2. Only PAID invoices contribute to revenue
 * 3. Draft, Unpaid, Partial invoices are EXCLUDED from revenue
 * 4. Period filter affects ALL metrics consistently
 * 
 * PERIOD LOGIC:
 * - week: Last 7 days
 * - month: Current month (1st to today)
 * - lastMonth: Previous month (1st to last day)
 * - quarter: Last 3 months
 * - year: Current year (Jan 1 to today)
 */

// Helper: Get date range for period
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
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate, endDate };
}

@Injectable()
export class StatsService {
    constructor(private prisma: PrismaService) { }

    /**
     * UNIFIED REVENUE METRICS
     * Single source of truth for all revenue calculations
     * @param buyerId - Optional buyer ID to filter metrics
     */
    private async getRevenueMetrics(period: string, startDate: Date, endDate: Date, buyerId?: number) {
        // Build where clause with optional buyer filter
        const where: any = {
            status: { notIn: ['Draft'] },
            createdAt: { gte: startDate, lte: endDate },
        };
        if (buyerId) {
            where.buyerId = buyerId;
        }

        // Get all non-draft invoices within the period with their payments
        const periodInvoices = await this.prisma.invoice.findMany({
            where,
            include: { payments: true },
        });

        // Calculate for each invoice
        let totalRevenue = 0;        // Sum of ALL invoice totals (not just paid)
        let receivedAmount = 0;      // Sum of all payments  
        let paidCount = 0;           // Count of PAID invoices
        let unpaidCount = 0;         // Count of UNPAID invoices
        let partialCount = 0;        // Count of PARTIAL invoices

        // For graph data - collect ALL invoices by date (not just paid)
        const allInvoicesForGraph: Array<{ createdAt: Date; total: number; received: number }> = [];

        for (const inv of periodInvoices) {
            const invReceived = inv.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const invTotal = Number(inv.total || 0);

            // Add ALL invoices to graph data (real-time sales)
            totalRevenue += invTotal;       // Count all sales
            receivedAmount += invReceived;  // Count all received

            allInvoicesForGraph.push({
                createdAt: inv.createdAt,
                total: invTotal,
                received: invReceived
            });

            if (invReceived >= invTotal) {
                paidCount++;
            } else if (invReceived > 0) {
                partialCount++;
            } else {
                unpaidCount++;
            }
        }

        return {
            totalRevenue,      // Sum of ALL invoice totals
            receivedAmount,    // Sum of all payments  
            paidCount,
            unpaidCount,
            partialCount,
            paidInvoices: allInvoicesForGraph,  // Now includes ALL invoices for graph
            allInvoices: periodInvoices.length,
        };
    }

    /**
     * Generate graph data points based on period
     */
    private generateGraphData(
        period: string,
        paidInvoices: Array<{ createdAt: Date; total: number }>,
        startDate: Date,
        endDate: Date
    ): Array<{ label: string; total: number }> {
        const now = new Date();

        if (period === 'week') {
            // Last 7 days (day-wise)
            const days: Array<{ key: string; date: Date; total: number }> = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                d.setHours(0, 0, 0, 0);
                const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                days.push({ key, date: d, total: 0 });
            }

            for (const inv of paidInvoices) {
                const invDate = new Date(inv.createdAt);
                invDate.setHours(0, 0, 0, 0);
                const day = days.find(d => d.date.getTime() === invDate.getTime());
                if (day) {
                    day.total += inv.total;
                }
            }
            return days.map(d => ({ label: d.key, total: d.total }));

        } else if (period === 'month' || period === 'lastMonth') {
            // Month (week-wise)
            const monthStart = period === 'lastMonth'
                ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
                : new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = period === 'lastMonth'
                ? new Date(now.getFullYear(), now.getMonth(), 0)
                : new Date(now.getFullYear(), now.getMonth() + 1, 0);

            const weeks: Array<{ label: string; start: Date; end: Date; total: number }> = [];
            let weekStart = new Date(monthStart);
            let weekNum = 1;

            while (weekStart <= monthEnd) {
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);
                if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());

                weeks.push({
                    label: `Week ${weekNum}`,
                    start: new Date(weekStart),
                    end: new Date(weekEnd),
                    total: 0
                });
                weekStart.setDate(weekStart.getDate() + 7);
                weekNum++;
            }

            for (const inv of paidInvoices) {
                const invDate = new Date(inv.createdAt);
                const week = weeks.find(w => invDate >= w.start && invDate <= w.end);
                if (week) {
                    week.total += inv.total;
                }
            }
            return weeks.map(w => ({ label: w.label, total: w.total }));

        } else if (period === 'quarter') {
            // Last 3 months (month-wise)
            const months: Array<{ key: string; year: number; month: number; total: number }> = [];
            for (let i = 2; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
                months.push({ key, year: d.getFullYear(), month: d.getMonth(), total: 0 });
            }

            for (const inv of paidInvoices) {
                const d = new Date(inv.createdAt);
                const month = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
                if (month) {
                    month.total += inv.total;
                }
            }
            return months.map(m => ({ label: m.key, total: m.total }));

        } else {
            // Year - last 12 months (month-wise)
            const months: Array<{ key: string; year: number; month: number; total: number }> = [];
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                months.push({ key, year: d.getFullYear(), month: d.getMonth(), total: 0 });
            }

            for (const inv of paidInvoices) {
                const d = new Date(inv.createdAt);
                const month = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
                if (month) {
                    month.total += inv.total;
                }
            }
            return months.map(m => ({ label: m.key, total: m.total }));
        }
    }

    /**
     * Main stats endpoint
     * Accepts optional from/to for custom date ranges
     * Accepts optional buyerId for buyer-specific filtering
     */
    async getStats(period: string = 'month', from?: string, to?: string, buyerId?: number) {
        let startDate: Date;
        let endDate: Date;

        // Use custom date range if provided
        if (from && to) {
            startDate = new Date(from);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
            period = 'custom';
        } else {
            const range = getDateRange(period);
            startDate = range.startDate;
            endDate = range.endDate;
        }

        console.log(`[Stats] Period: ${period}, From: ${startDate.toISOString()}, To: ${endDate.toISOString()}, BuyerId: ${buyerId || 'ALL'}`);

        // Get counts (not period-filtered - for entity counts)
        const [users, suppliers, buyers, products] = await Promise.all([
            this.prisma.user.count({ where: { isArchived: false } }).catch(() => 0),
            this.prisma.supplier.count().catch(() => 0),
            this.prisma.buyer.count().catch(() => 0),
            this.prisma.product.count().catch(() => 0),
        ]);

        // Build invoice where clause with optional buyer filter
        const invoiceWhereBase: any = {
            createdAt: { gte: startDate, lte: endDate }
        };
        if (buyerId) {
            invoiceWhereBase.buyerId = buyerId;
        }

        // Get period-filtered draft count
        const periodDraftCount = await this.prisma.invoice.count({
            where: {
                ...invoiceWhereBase,
                status: 'Draft',
            }
        }).catch(() => 0);

        // Get all-time completed count (for KPI card) - also apply buyer filter if present
        const allInvoicesWhere: any = { status: { notIn: ['Draft'] } };
        if (buyerId) {
            allInvoicesWhere.buyerId = buyerId;
        }
        const allInvoices = await this.prisma.invoice.findMany({
            where: allInvoicesWhere,
            include: { payments: true },
        });
        const completedCount = allInvoices.filter((inv: any) => {
            const received = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
            return received >= Number(inv.total || 0);
        }).length;

        // ==========================================
        // UNIFIED REVENUE METRICS (period-filtered)
        // ==========================================
        const revenueMetrics = await this.getRevenueMetrics(period, startDate, endDate, buyerId);

        // Generate graph data from PAID invoices only
        const revenueByMonth = this.generateGraphData(
            period,
            revenueMetrics.paidInvoices,
            startDate,
            endDate
        );

        // Validate: Total Revenue >= Received Amount
        console.log(`[Stats] Period: ${period}`);
        console.log(`[Stats] Total Revenue: ${revenueMetrics.totalRevenue}`);
        console.log(`[Stats] Received Amount: ${revenueMetrics.receivedAmount}`);
        console.log(`[Stats] Graph Sum: ${revenueByMonth.reduce((s, d) => s + d.total, 0)}`);

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
            invoices: { draft: periodDraftCount, completed: completedCount },
            revenueByMonth,
            recentProducts,

            // UNIFIED REVENUE METRICS (period-filtered)
            totalSales: revenueMetrics.totalRevenue,      // Total Revenue = PAID invoice totals
            totalRevenue: revenueMetrics.totalRevenue,    // Alias for frontend
            receivedAmount: revenueMetrics.receivedAmount, // Payments received for PAID invoices
            balancePending: revenueMetrics.totalRevenue - revenueMetrics.receivedAmount, // Balance = Sales - Received

            // Period-filtered invoice counts
            paidInvoicesCount: revenueMetrics.paidCount,
            unpaidInvoicesCount: revenueMetrics.unpaidCount,
            partialInvoicesCount: revenueMetrics.partialCount,
            periodInvoicesCount: revenueMetrics.paidCount + revenueMetrics.unpaidCount + revenueMetrics.partialCount + periodDraftCount,

            todayStats,
            period,
        };
    }
}
