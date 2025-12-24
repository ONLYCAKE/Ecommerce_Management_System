import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatusService } from '../services/invoice-status.service';
import { roundToTwoDecimals } from '../services/round-off.util';

@Injectable()
export class InvoicesService {
    constructor(
        private prisma: PrismaService,
        private invoiceStatusService: InvoiceStatusService,
    ) { }

    // Matching backend-v2 invoiceController.ts getAllInvoices (lines 14-101)
    async findAll(query: {
        status?: string;
        paymentMethod?: string;
        sortBy?: string;
        sortOrder?: string;
        date?: string;
        dateFrom?: string;
        dateTo?: string;
        partyName?: string;
    }) {
        const { status, paymentMethod, sortBy, sortOrder, dateFrom, dateTo, date, partyName } = query;

        const where: any = {};

        if (status && status !== 'All') {
            where.status = status;
        }

        if (paymentMethod) {
            const methods = paymentMethod.split(',');
            where.paymentMethod = { in: methods };
        }

        // Date range filtering
        if (dateFrom && dateTo) {
            const [fromYear, fromMonth, fromDay] = dateFrom.split('-').map(Number);
            const [toYear, toMonth, toDay] = dateTo.split('-').map(Number);

            const startDate = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
            const endDate = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

            where.invoiceDate = { gte: startDate, lte: endDate };
        } else if (date) {
            const filterDate = new Date(date);
            const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));
            where.createdAt = { gte: startOfDay, lte: endOfDay };
        }

        if (partyName) {
            where.buyer = { name: { contains: partyName, mode: 'insensitive' } };
        }

        let orderBy: any = { createdAt: 'desc' };
        if (sortBy === 'invoiceNo') {
            orderBy = { invoiceNo: sortOrder === 'asc' ? 'asc' : 'desc' };
        } else if (sortBy === 'total') {
            orderBy = { total: sortOrder === 'asc' ? 'asc' : 'desc' };
        }

        const items = await this.prisma.invoice.findMany({
            where,
            include: {
                buyer: true,
                supplier: true,
                items: { include: { product: true } },
                payments: true,
            },
            orderBy,
        });

        // Calculate receivedAmount for each invoice
        const itemsWithPayments = items.map((inv: any) => {
            const receivedAmount = inv.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
            return { ...inv, receivedAmount };
        });

        return itemsWithPayments;
    }

    // Matching backend-v2 invoiceController.ts getInvoiceSummary (lines 103-155)
    async getSummary(query: { status?: string; paymentMethod?: string }) {
        const { status, paymentMethod } = query;
        const where: any = {};

        if (status && status !== 'All') {
            where.status = status;
        }
        if (paymentMethod) {
            where.paymentMethod = { in: paymentMethod.split(',') };
        }

        const invoices = await this.prisma.invoice.findMany({
            where,
            include: { payments: true },
        });

        let totalSales = 0;
        let totalReceived = 0;
        let totalBalance = 0;

        invoices.forEach((inv: any) => {
            const receivedAmount = inv.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
            totalSales += inv.total;
            totalReceived += receivedAmount;
            totalBalance += inv.total - receivedAmount;
        });

        return { totalSales, totalReceived, totalBalance, count: invoices.length };
    }

    // Matching backend-v2 invoiceController.ts getNextInvoiceNo (lines 157-184)
    async getNextInvoiceNo() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `INV-${y}${m}-`;

        const last = await this.prisma.invoice.findFirst({
            where: { invoiceNo: { startsWith: prefix } },
            orderBy: { createdAt: 'desc' },
            select: { invoiceNo: true },
        });

        let nextCounter = 1;
        if (last?.invoiceNo) {
            const seq = last.invoiceNo.split('-')[2] || '0000';
            const n = parseInt(seq, 10);
            if (!Number.isNaN(n)) nextCounter = n + 1;
        }

        return { invoiceNo: `${prefix}${String(nextCounter).padStart(4, '0')}` };
    }

    // Matching backend-v2 invoiceController.ts getInvoiceByNo (lines 186-200)
    async findByNo(invoiceNo: string) {
        const item = await this.prisma.invoice.findUnique({
            where: { invoiceNo },
            include: { buyer: true, supplier: true, items: { include: { product: true } } },
        });
        if (!item) throw new NotFoundException('Invoice not found');
        return item;
    }

    // Matching backend-v2 invoiceController.ts createInvoice (lines 202-358)
    async create(body: any, userId: number) {
        const {
            invoiceNo,
            buyerId,
            paymentMethod = null,
            items = [],
            serviceCharge = 0,
            payments = [],
            receivedAmount = 0,
        } = body;

        if (!invoiceNo || !buyerId) {
            throw new BadRequestException('Invoice number and buyer are required.');
        }

        // Normalize items
        const normalized = (items as any[])
            .filter((it) => (it.title || it.productId) && Number(it.qty) > 0)
            .map((it) => ({
                ...(it.productId ? { productId: Number(it.productId) } : {}),
                title: it.title || it.productTitle || 'Untitled Item',
                description: it.description || null,
                qty: Number(it.qty) || 1,
                price: Number(it.price) || 0,
                gst: Number(it.gst) || 0,
                discountPct: Number(it.discountPct) || 0,
                hsnCode: it.hsnCode || null,
                amount:
                    (Number(it.price) || 0) *
                    (Number(it.qty) || 1) *
                    (1 - (Number(it.discountPct) || 0) / 100) *
                    (1 + (Number(it.gst) || 0) / 100),
            }));

        const rawTotal = normalized.reduce((s, it) => s + it.amount, 0) + Number(serviceCharge || 0);
        const total = roundToTwoDecimals(rawTotal);

        // Derive supplier from first product
        let derivedSupplierId: number | null = null;
        const firstProduct = (items as any[]).find((n) => n.productId);
        if (firstProduct) {
            const prod = await this.prisma.product.findUnique({ where: { id: Number(firstProduct.productId) } });
            derivedSupplierId = prod?.supplierId ?? null;
        }

        // Backward compatibility: convert old receivedAmount to payments array
        let paymentsToCreate = payments.length > 0 ? payments : [];
        if (receivedAmount > 0 && payments.length === 0) {
            paymentsToCreate = [{
                amount: receivedAmount,
                roundOff: 0,
                mode: paymentMethod || 'Cash',
                note: `Initial payment for ${invoiceNo}`,
            }];
        }

        // Transaction for atomicity
        const invoiceId = await this.prisma.$transaction(async (tx) => {
            const finalInvoiceNo = body.status === 'Draft'
                ? `DRAFT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                : invoiceNo;

            const invoiceData: any = {
                invoiceNo: finalInvoiceNo,
                buyer: { connect: { id: Number(buyerId) } },
                paymentMethod: paymentMethod as any,
                status: body.status === 'Draft' ? 'Draft' : 'Unpaid',
                total,
                balance: total,
                serviceCharge: Number(serviceCharge || 0),
                signature: body.signature || null,
                notes: body.notes || null,
                extraCharges: body.extraCharges || null,
                items: { create: normalized as any },
            };

            if (derivedSupplierId) {
                invoiceData.supplier = { connect: { id: derivedSupplierId } };
            }

            const invoice = await tx.invoice.create({ data: invoiceData });

            // Create all payments
            for (const payment of paymentsToCreate) {
                await tx.payment.create({
                    data: {
                        invoiceId: invoice.id,
                        amount: Number(payment.amount),
                        roundOff: Number(payment.roundOff || 0),
                        method: payment.mode || payment.method || 'Cash',
                        reference: payment.note || payment.reference || `Payment for ${invoiceNo}`,
                        createdBy: userId,
                    } as any,
                });
            }

            // Recalculate status
            await this.invoiceStatusService.recalculateAndUpdateInvoiceStatus(invoice.id, {
                skipEmit: true,
                transaction: tx,
            });

            return invoice.id;
        });

        const created = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { buyer: true, supplier: true, items: { include: { product: true } } },
        });

        // Recalculate status again to emit event
        await this.invoiceStatusService.recalculateAndUpdateInvoiceStatus(invoiceId);

        return created;
    }

    // Matching backend-v2 invoiceController.ts updateInvoice (lines 360-490)
    async update(invoiceNo: string, body: any) {
        const { buyerId, supplierId, paymentMethod, status, items, serviceCharge, signature } = body;

        const existing = await this.prisma.invoice.findUnique({
            where: { invoiceNo },
            include: { payments: true },
        });

        if (!existing) throw new NotFoundException('Invoice not found');

        if (existing.status === 'Cancelled') {
            throw new BadRequestException('Cannot update cancelled invoice. Please restore it first.');
        }

        if (status && status !== existing.status) {
            throw new BadRequestException('Status cannot be changed manually. It is automatically calculated based on payments.');
        }

        let newTotal: number | undefined;
        let normalized: any[] | undefined;

        if (Array.isArray(items)) {
            normalized = (items as any[])
                .filter((it) => (it.title || it.productId) && Number(it.qty) > 0)
                .map((it) => ({
                    ...(it.productId ? { productId: Number(it.productId) } : {}),
                    title: it.title || 'Untitled Item',
                    description: it.description || null,
                    qty: Number(it.qty) || 1,
                    price: Number(it.price) || 0,
                    gst: Number(it.gst) || 0,
                    discountPct: Number(it.discountPct) || 0,
                    hsnCode: it.hsnCode || null,
                    amount:
                        (Number(it.price) || 0) *
                        (Number(it.qty) || 1) *
                        (1 - (Number(it.discountPct) || 0) / 100) *
                        (1 + (Number(it.gst) || 0) / 100),
                }));

            const rawNewTotal = normalized.reduce((s, it) => s + it.amount, 0) + Number(serviceCharge || 0);
            newTotal = roundToTwoDecimals(rawNewTotal);
        }

        // Validate total reduction against payments
        if (newTotal !== undefined && newTotal !== existing.total) {
            const receivedAmount = existing.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
            if (newTotal < receivedAmount) {
                throw new BadRequestException(
                    `Cannot reduce invoice total to ₹${newTotal.toFixed(2)} as ₹${receivedAmount.toFixed(2)} has already been paid.`
                );
            }
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            if (normalized) {
                await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
            }

            const updateData: any = {
                ...(buyerId && { buyer: { connect: { id: Number(buyerId) } } }),
                ...(supplierId && { supplier: { connect: { id: Number(supplierId) } } }),
                ...(paymentMethod && { paymentMethod }),
                ...(signature !== undefined && { signature }),
                ...(serviceCharge !== undefined && { serviceCharge: Number(serviceCharge) }),
                ...(normalized && { items: { create: normalized } }),
                ...(newTotal !== undefined && { total: newTotal }),
            };

            const inv = await tx.invoice.update({
                where: { id: existing.id },
                data: updateData,
            });

            if (newTotal !== undefined && newTotal !== existing.total) {
                await this.invoiceStatusService.recalculateAndUpdateInvoiceStatus(inv.id, {
                    skipEmit: true,
                    transaction: tx,
                });
            }

            return inv.id;
        });

        const result = await this.prisma.invoice.findUnique({
            where: { id: updated },
            include: { buyer: true, supplier: true, items: { include: { product: true } } },
        });

        if (newTotal !== undefined && newTotal !== existing.total) {
            await this.invoiceStatusService.recalculateAndUpdateInvoiceStatus(result!.id);
        }

        return result;
    }

    // Matching backend-v2 invoiceController.ts finalizeInvoice
    async finalize(invoiceNo: string) {
        const existing = await this.prisma.invoice.findUnique({
            where: { invoiceNo },
        });

        if (!existing) throw new NotFoundException('Invoice not found');
        if (existing.status !== 'Draft') {
            throw new BadRequestException('Only draft invoices can be finalized');
        }

        // Generate proper invoice number
        const { invoiceNo: newInvoiceNo } = await this.getNextInvoiceNo();

        const updated = await this.prisma.invoice.update({
            where: { id: existing.id },
            data: {
                invoiceNo: newInvoiceNo,
                status: 'Unpaid',
            },
        });

        return updated;
    }
}
