import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
export class DashboardService {
    constructor(private prisma: PrismaService) { }

    /**
     * Get all dashboard analytics in a single API call
     * Returns: buyerWiseSales, productWiseSales, topBuyersTable, collectionSummary
     */
    async getAnalytics(from?: string, to?: string, period: string = 'month') {
        let startDate: Date;
        let endDate: Date;

        // Use custom date range if provided
        if (from && to) {
            startDate = new Date(from);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const range = getDateRange(period);
            startDate = range.startDate;
            endDate = range.endDate;
        }

        // Get all invoices with buyer and items for the period
        const invoices = await this.prisma.invoice.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                status: { notIn: ['Draft'] } // Exclude drafts from analytics
            },
            include: {
                buyer: true,
                items: {
                    include: {
                        product: true
                    }
                },
                payments: true
            }
        });

        console.log(`[Dashboard Analytics] Period: ${period}, From: ${startDate.toISOString()}, To: ${endDate.toISOString()}`);
        console.log(`[Dashboard Analytics] Found ${invoices.length} invoices`);
        if (invoices.length > 0) {
            const sampleInv = invoices[0];
            console.log(`[Dashboard Analytics] Sample invoice: ${sampleInv.invoiceNo}, items: ${sampleInv.items?.length || 0}`);
            if (sampleInv.items && sampleInv.items.length > 0) {
                const sampleItem = sampleInv.items[0] as any;
                console.log(`[Dashboard Analytics] Sample item: title=${sampleItem.title}, amount=${sampleItem.amount}, qty=${sampleItem.qty}, price=${sampleItem.price}, productId=${sampleItem.productId}`);
            }
        }

        // ============================
        // 1. BUYER-WISE SALES (Top 5)
        // ============================
        const buyerSalesMap = new Map<number, { name: string; total: number; count: number }>();

        invoices.forEach(inv => {
            if (!inv.buyer) return;
            const existing = buyerSalesMap.get(inv.buyer.id) || { name: inv.buyer.name, total: 0, count: 0 };
            existing.total += Number(inv.total || 0);
            existing.count += 1;
            buyerSalesMap.set(inv.buyer.id, existing);
        });

        const buyerWiseSales = Array.from(buyerSalesMap.entries())
            .map(([id, data]) => ({ id, name: data.name, total: data.total, count: data.count }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        // Calculate percentage for pie chart
        const totalBuyerSales = buyerWiseSales.reduce((sum, b) => sum + b.total, 0);
        const buyerWiseSalesWithPercent = buyerWiseSales.map(b => ({
            ...b,
            percentage: totalBuyerSales > 0 ? Math.round((b.total / totalBuyerSales) * 100) : 0
        }));

        // ============================
        // 2. PRODUCT-WISE SALES (Top 5)
        // ============================
        const productSalesMap = new Map<string, { id: number | null; name: string; total: number; quantity: number }>();

        invoices.forEach(inv => {
            (inv.items || []).forEach((item: any) => {
                // Use productId if available, otherwise use title as key
                const key = item.productId ? `product_${item.productId}` : `title_${item.title}`;
                const productName = item.product?.title || item.title || 'Unknown Product';
                const existing = productSalesMap.get(key) || { id: item.productId || null, name: productName, total: 0, quantity: 0 };
                // Use 'amount' field from InvoiceItem schema, fallback to qty * price
                const itemAmount = Number(item.amount) || (Number(item.qty) || 0) * (Number(item.price) || 0);
                existing.total += itemAmount;
                existing.quantity += Number(item.qty || 0);
                productSalesMap.set(key, existing);
            });
        });

        const productWiseSales = Array.from(productSalesMap.entries())
            .map(([key, data]) => ({ id: data.id || 0, name: data.name, total: data.total, quantity: data.quantity }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        // Calculate percentage for pie chart
        const totalProductSales = productWiseSales.reduce((sum, p) => sum + p.total, 0);
        const productWiseSalesWithPercent = productWiseSales.map(p => ({
            ...p,
            percentage: totalProductSales > 0 ? Math.round((p.total / totalProductSales) * 100) : 0
        }));

        // ============================
        // 3. TOP BUYERS TABLE (with details)
        // ============================
        const topBuyersTable = Array.from(buyerSalesMap.entries())
            .map(([id, data]) => {
                // Calculate pending balance for this buyer
                const buyerInvoices = invoices.filter(inv => inv.buyer?.id === id);
                const totalSales = buyerInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
                const totalReceived = buyerInvoices.reduce((sum, inv) => {
                    const payments = (inv.payments || []).reduce((pSum: number, p: any) => pSum + Number(p.amount || 0), 0);
                    return sum + payments;
                }, 0);
                const pendingBalance = totalSales - totalReceived;

                return {
                    id,
                    buyerName: data.name,
                    totalInvoices: data.count,
                    totalSales: data.total,
                    totalReceived,
                    pendingBalance
                };
            })
            .sort((a, b) => b.totalSales - a.totalSales)
            .slice(0, 10);

        // ============================
        // 4. COLLECTION SUMMARY
        // ============================
        let totalSales = 0;
        let totalReceived = 0;

        invoices.forEach(inv => {
            totalSales += Number(inv.total || 0);
            const received = (inv.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
            totalReceived += received;
        });

        const pendingAmount = totalSales - totalReceived;
        const collectionPercentage = totalSales > 0 ? Math.round((totalReceived / totalSales) * 100) : 0;

        const collectionSummary = {
            totalSales,
            totalReceived,
            pendingAmount,
            collectionPercentage,
            invoiceCount: invoices.length
        };

        // ============================
        // RESPONSE
        // ============================
        return {
            buyerWiseSales: buyerWiseSalesWithPercent,
            productWiseSales: productWiseSalesWithPercent,
            topBuyersTable,
            collectionSummary,
            period,
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            }
        };
    }
}
