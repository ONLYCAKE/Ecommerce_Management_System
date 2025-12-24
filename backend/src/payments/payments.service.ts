import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatusService } from '../services/invoice-status.service';
import { roundToTwoDecimals } from '../services/round-off.util';

@Injectable()
export class PaymentsService {
    constructor(
        private prisma: PrismaService,
        private invoiceStatusService: InvoiceStatusService,
    ) { }

    // Matching backend-v2 paymentController.ts createPayment (lines 15-91)
    async create(dto: any, userId: number) {
        const { invoiceNo, amount, method, reference } = dto;

        if (!invoiceNo || amount === undefined || !method) {
            throw new BadRequestException('Missing required fields');
        }

        const paymentAmount = roundToTwoDecimals(Number(amount));
        if (paymentAmount <= 0) {
            throw new BadRequestException('Amount must be greater than 0');
        }

        const invoice = await this.prisma.invoice.findUnique({
            where: { invoiceNo },
            include: { payments: true },
        });

        if (!invoice) {
            throw new NotFoundException('Invoice not found');
        }

        const canPay = await this.invoiceStatusService.canReceivePayment(invoice.id);
        if (!canPay.allowed) {
            throw new BadRequestException(canPay.reason);
        }

        const receivedAmount = roundToTwoDecimals(
            invoice.payments.reduce((sum: number, p: any) => sum + p.amount, 0)
        );
        const remainingBalance = roundToTwoDecimals(invoice.total - receivedAmount);

        if (paymentAmount > remainingBalance) {
            throw new BadRequestException(
                `Payment amount exceeds remaining balance (₹${remainingBalance.toFixed(2)})`
            );
        }

        const payment = await this.prisma.$transaction(async (tx) => {
            const pmt = await tx.payment.create({
                data: {
                    invoiceId: invoice.id,
                    amount: paymentAmount,
                    method,
                    reference: reference || null,
                    createdBy: userId,
                },
            });

            await this.invoiceStatusService.recalculateAndUpdateInvoiceStatus(invoice.id, {
                skipEmit: true,
                transaction: tx,
            });

            return pmt;
        });

        // Recalculate again for event emission
        await this.invoiceStatusService.recalculateAndUpdateInvoiceStatus(invoice.id);

        return payment;
    }

    // Matching backend-v2 paymentController.ts updatePayment (lines 93-164)
    async update(id: number, dto: any) {
        const { amount, method, reference } = dto;

        const existing = await this.prisma.payment.findUnique({
            where: { id },
            include: { invoice: { include: { payments: true } } },
        });

        if (!existing) {
            throw new NotFoundException('Payment not found');
        }

        let updatedAmount: number | undefined;

        if (amount !== undefined) {
            updatedAmount = roundToTwoDecimals(Number(amount));
            if (updatedAmount <= 0) {
                throw new BadRequestException('Amount must be greater than 0');
            }

            const otherPaymentsTotal = roundToTwoDecimals(
                existing.invoice.payments
                    .filter((p: any) => p.id !== existing.id)
                    .reduce((sum: number, p: any) => sum + p.amount, 0)
            );

            const remainingBalance = roundToTwoDecimals(
                existing.invoice.total - otherPaymentsTotal
            );

            if (updatedAmount > remainingBalance) {
                throw new BadRequestException(
                    `Payment amount exceeds remaining balance (₹${remainingBalance.toFixed(2)})`
                );
            }
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            const pmt = await tx.payment.update({
                where: { id },
                data: {
                    amount: updatedAmount,
                    method: method || undefined,
                    reference: reference !== undefined ? reference : undefined,
                },
            });

            await this.invoiceStatusService.recalculateAndUpdateInvoiceStatus(existing.invoiceId, {
                skipEmit: true,
                transaction: tx,
            });

            return pmt;
        });

        await this.invoiceStatusService.recalculateAndUpdateInvoiceStatus(existing.invoiceId);

        return updated;
    }

    // Matching backend-v2 paymentController.ts deletePayment (lines 166-198)
    async remove(id: number) {
        const existing = await this.prisma.payment.findUnique({
            where: { id },
            include: { invoice: true },
        });

        if (!existing) {
            throw new NotFoundException('Payment not found');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.payment.delete({ where: { id } });

            await this.invoiceStatusService.recalculateAndUpdateInvoiceStatus(existing.invoiceId, {
                skipEmit: true,
                transaction: tx,
            });
        });

        return { message: 'Payment deleted successfully' };
    }

    // Matching backend-v2 paymentController.ts getPaymentsByInvoice (lines 200-226)
    async findByInvoice(invoiceNo: string) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { invoiceNo },
        });

        if (!invoice) {
            throw new NotFoundException('Invoice not found');
        }

        const payments = await this.prisma.payment.findMany({
            where: { invoiceId: invoice.id },
            include: {
                user: { select: { firstName: true, lastName: true, email: true } },
            },
            orderBy: { receivedAt: 'desc' },
        });

        return payments;
    }

    // Matching backend-v2 paymentController.ts getAllPaymentRecords (lines 228-270)
    async findAllRecords() {
        const payments = await this.prisma.payment.findMany({
            include: {
                invoice: {
                    select: { invoiceNo: true, total: true, balance: true, status: true },
                },
                user: { select: { firstName: true, lastName: true } },
            },
            orderBy: { receivedAt: 'desc' },
        });

        const result = payments.map((p: any) => ({
            id: p.id,
            invoiceId: p.invoiceId,
            invoiceNo: p.invoice.invoiceNo,
            paymentDate: p.receivedAt,
            paidAmount: p.amount,
            remainingBalance: p.invoice.balance,
            paymentMethod: p.method,
            reference: p.reference || '-',
            addedBy: p.user ? `${p.user.firstName} ${p.user.lastName}` : 'System',
            invoiceTotal: p.invoice.total,
            invoiceStatus: p.invoice.status,
        }));

        return result;
    }
}
