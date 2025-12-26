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
     * @param buyerId - Optional buyer ID to filter all analytics to a specific buyer
     */
    async getAnalytics(from?: string, to?: string, period: string = 'month', buyerId?: number) {
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

        // Build invoice query with optional buyer filter
        const invoiceWhere: any = {
            createdAt: { gte: startDate, lte: endDate },
            status: { notIn: ['Draft'] } // Exclude drafts from analytics
        };

        // Apply buyer filter if specified
        if (buyerId) {
            invoiceWhere.buyerId = buyerId;
        }

        // Get invoices with buyer and items for the period
        const invoices = await this.prisma.invoice.findMany({
            where: invoiceWhere,
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

        // Get buyer name if filtered
        let buyerName: string | null = null;
        if (buyerId) {
            const buyer = await this.prisma.buyer.findUnique({ where: { id: buyerId } });
            buyerName = buyer?.name || null;
        }

        console.log(`[Dashboard Analytics] Period: ${period}, From: ${startDate.toISOString()}, To: ${endDate.toISOString()}, BuyerId: ${buyerId || 'ALL'}`);
        console.log(`[Dashboard Analytics] Found ${invoices.length} invoices`);

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
        // 5. LOCATION-WISE SALES (Top 5 each)
        // ============================
        const countrySalesMap = new Map<string, number>();
        const stateSalesMap = new Map<string, number>();
        const citySalesMap = new Map<string, number>();
        const areaSalesMap = new Map<string, number>();

        invoices.forEach(inv => {
            const buyer = inv.buyer;
            if (!buyer) return;
            const amount = Number(inv.total || 0);

            // Country
            const country = buyer.country?.trim() || 'Unknown';
            countrySalesMap.set(country, (countrySalesMap.get(country) || 0) + amount);

            // State
            const state = buyer.state?.trim() || 'Unknown';
            stateSalesMap.set(state, (stateSalesMap.get(state) || 0) + amount);

            // City
            const city = buyer.city?.trim() || 'Unknown';
            citySalesMap.set(city, (citySalesMap.get(city) || 0) + amount);

            // Area
            const area = buyer.area?.trim() || 'Unknown';
            areaSalesMap.set(area, (areaSalesMap.get(area) || 0) + amount);
        });

        // Helper to convert map to sorted array with percentage (Top 5 + Others)
        const mapToSalesArray = (map: Map<string, number>, limit: number = 5) => {
            const entries = Array.from(map.entries())
                .map(([name, total]) => ({ name, total }))
                .sort((a, b) => b.total - a.total);

            const totalAmount = entries.reduce((sum, e) => sum + e.total, 0);

            if (entries.length <= limit) {
                return entries.map(e => ({
                    ...e,
                    percentage: totalAmount > 0 ? Math.round((e.total / totalAmount) * 100) : 0
                }));
            }

            // Top N + "Others"
            const topN = entries.slice(0, limit);
            const othersTotal = entries.slice(limit).reduce((sum, e) => sum + e.total, 0);

            const result = topN.map(e => ({
                ...e,
                percentage: totalAmount > 0 ? Math.round((e.total / totalAmount) * 100) : 0
            }));

            if (othersTotal > 0) {
                result.push({
                    name: 'Others',
                    total: othersTotal,
                    percentage: totalAmount > 0 ? Math.round((othersTotal / totalAmount) * 100) : 0
                });
            }

            return result;
        };

        const salesByCountry = mapToSalesArray(countrySalesMap);
        const salesByState = mapToSalesArray(stateSalesMap);
        const salesByCity = mapToSalesArray(citySalesMap);
        const salesByArea = mapToSalesArray(areaSalesMap);

        // ============================
        // RESPONSE
        // ============================
        return {
            buyerWiseSales: buyerWiseSalesWithPercent,
            productWiseSales: productWiseSalesWithPercent,
            topBuyersTable,
            collectionSummary,
            // Location-wise sales
            salesByCountry,
            salesByState,
            salesByCity,
            salesByArea,
            period,
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            },
            // Buyer filter info (for UI to display)
            buyerFilter: buyerId ? { id: buyerId, name: buyerName } : null
        };
    }
}
