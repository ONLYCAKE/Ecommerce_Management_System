import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProformaInvoicesService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.proformaInvoice.findMany({
            include: { buyer: true },
            orderBy: { proformaDate: 'desc' },
        });
    }

    async findOne(id: number) {
        if (isNaN(id)) throw new BadRequestException('Invalid id');

        const proforma = await this.prisma.proformaInvoice.findUnique({
            where: { id },
            include: { buyer: true, items: { include: { product: true } } },
        });

        if (!proforma) throw new NotFoundException('Proforma not found');
        return proforma;
    }

    async create(data: any) {
        const { buyerId, proformaDate, validTill, items = [], notes, terms, extraCharges, signature } = data;

        if (!buyerId) throw new BadRequestException('buyerId is required');

        const normalizedItems = (items as any[]).map((it) => {
            const qty = Number(it.qty) || 1;
            const price = Number(it.price) || 0;
            const gst = Number(it.gst) || 0;
            const lineSubtotal = qty * price;
            const lineGstAmount = (lineSubtotal * gst) / 100;
            const amount = lineSubtotal + lineGstAmount;

            return {
                productId: it.productId ?? null,
                title: it.title ?? 'Item',
                description: it.description ?? null,
                qty,
                price,
                gst,
                discountPct: Number(it.discountPct) || 0,
                hsnCode: it.hsnCode ?? null,
                amount,
            };
        });

        const total = normalizedItems.reduce((sum, it) => sum + (it.amount || 0), 0);

        const last = await this.prisma.proformaInvoice.findFirst({
            orderBy: { id: 'desc' },
        });
        const nextNo = last ? last.id + 1 : 1;
        const proformaNo = `PF-${nextNo.toString().padStart(4, '0')}`;

        return this.prisma.proformaInvoice.create({
            data: {
                proformaNo,
                buyerId: Number(buyerId),
                proformaDate: proformaDate ? new Date(proformaDate) : undefined,
                validTill: validTill ? new Date(validTill) : undefined,
                status: 'Draft',
                total,
                notes: notes ?? null,
                terms: terms ?? null,
                extraCharges: extraCharges ?? null,
                signature: signature ?? null,
                items: {
                    create: normalizedItems,
                },
            },
            include: { buyer: true, items: true },
        });
    }

    async update(id: number, data: any) {
        if (isNaN(id)) throw new BadRequestException('Invalid id');

        const existing = await this.prisma.proformaInvoice.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Proforma not found');
        if (existing.status === 'Converted' || existing.status === 'Cancelled') {
            throw new BadRequestException('Cannot modify a converted or cancelled proforma');
        }

        const { buyerId, proformaDate, validTill, items = [], notes, terms, extraCharges, signature, status } = data;

        const normalizedItems = (items as any[]).map((it) => {
            const qty = Number(it.qty) || 1;
            const price = Number(it.price) || 0;
            const gst = Number(it.gst) || 0;
            const lineSubtotal = qty * price;
            const lineGstAmount = (lineSubtotal * gst) / 100;
            const amount = lineSubtotal + lineGstAmount;

            return {
                productId: it.productId ?? null,
                title: it.title ?? 'Item',
                description: it.description ?? null,
                qty,
                price,
                gst,
                discountPct: Number(it.discountPct) || 0,
                hsnCode: it.hsnCode ?? null,
                amount,
            };
        });

        const total = normalizedItems.reduce((sum, it) => sum + (it.amount || 0), 0);

        return this.prisma.proformaInvoice.update({
            where: { id },
            data: {
                buyerId: buyerId ? Number(buyerId) : existing.buyerId,
                proformaDate: proformaDate ? new Date(proformaDate) : existing.proformaDate,
                validTill: validTill ? new Date(validTill) : existing.validTill,
                status: status ?? existing.status,
                total,
                notes: notes ?? existing.notes,
                terms: terms ?? existing.terms,
                extraCharges: extraCharges ?? existing.extraCharges,
                signature: signature ?? existing.signature,
                items: {
                    deleteMany: {},
                    create: normalizedItems,
                },
            },
            include: { buyer: true, items: true },
        });
    }

    async remove(id: number) {
        if (isNaN(id)) throw new BadRequestException('Invalid id');

        const existing = await this.prisma.proformaInvoice.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Proforma not found');
        if (existing.status !== 'Draft') {
            throw new BadRequestException('Only draft proformas can be deleted');
        }

        await this.prisma.proformaItem.deleteMany({ where: { proformaId: id } });
        await this.prisma.proformaInvoice.delete({ where: { id } });

        return { message: 'Proforma deleted' };
    }

    async convertToInvoice(id: number) {
        if (isNaN(id)) throw new BadRequestException('Invalid id');

        const proforma = await this.prisma.proformaInvoice.findUnique({
            where: { id },
            include: { items: true, invoice: true },
        });

        if (!proforma) throw new NotFoundException('Proforma not found');
        if (proforma.status === 'Converted') {
            throw new BadRequestException('Proforma already converted');
        }
        if (proforma.invoice) {
            throw new BadRequestException('Invoice already exists for this proforma');
        }

        // Generate next invoice number
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
            if (!isNaN(n)) nextCounter = n + 1;
        }

        const invoiceNo = `${prefix}${String(nextCounter).padStart(4, '0')}`;

        const createdInvoice = await this.prisma.invoice.create({
            data: {
                invoiceNo,
                buyerId: proforma.buyerId,
                paymentMethod: null,
                status: 'Draft',
                total: 0,
                balance: 0,
                serviceCharge: 0,
                signature: proforma.signature ?? null,
                notes: proforma.notes ?? null,
                extraCharges: proforma.extraCharges ?? undefined,
                proformaId: proforma.id,
                items: {
                    create: proforma.items.map((it) => ({
                        productId: it.productId ?? null,
                        title: it.title,
                        description: it.description ?? null,
                        qty: it.qty,
                        price: it.price,
                        gst: it.gst,
                        discountPct: it.discountPct,
                        hsnCode: it.hsnCode ?? null,
                        amount: 0,
                    })),
                },
            },
        });

        const updated = await this.prisma.proformaInvoice.update({
            where: { id },
            data: { status: 'Converted' },
        });

        return {
            message: 'Proforma converted to draft invoice successfully',
            proforma: updated,
            invoice: createdInvoice,
        };
    }
}
