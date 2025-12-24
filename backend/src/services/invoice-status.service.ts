import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { roundToTwoDecimals } from './round-off.util';

export interface InvoiceStatusResult {
    status: 'Draft' | 'Unpaid' | 'Partial' | 'Paid' | 'Cancelled';
    balance: number;
    receivedAmount: number;
}

/**
 * SINGLE SOURCE OF TRUTH for invoice status calculation
 * Matching backend-v2 services/invoiceStatusService.ts exactly
 */
@Injectable()
export class InvoiceStatusService {
    constructor(private prisma: PrismaService) { }

    // Matching backend-v2 recalculateAndUpdateInvoiceStatus (lines 28-104)
    async recalculateAndUpdateInvoiceStatus(
        invoiceId: number,
        options: { skipEmit?: boolean; transaction?: any } = {}
    ): Promise<InvoiceStatusResult> {
        const db = options.transaction || this.prisma;

        // Fetch invoice with all payments
        const invoice = await db.invoice.findUnique({
            where: { id: invoiceId },
            include: { payments: true }
        });

        if (!invoice) {
            throw new Error(`Invoice ${invoiceId} not found`);
        }

        // Calculate from payments (SINGLE SOURCE OF TRUTH)
        const receivedAmount = roundToTwoDecimals(
            invoice.payments.reduce((sum: number, p: any) => sum + p.amount, 0)
        );
        const balance = roundToTwoDecimals(invoice.total - receivedAmount);

        // Preserve Draft status - NEVER auto-transition
        if (invoice.status === 'Draft') {
            await db.invoice.update({
                where: { id: invoiceId },
                data: { balance }
            });
            return { status: 'Draft', balance, receivedAmount };
        }

        // Preserve Cancelled status - never recalculate
        if (invoice.status === 'Cancelled') {
            return {
                status: 'Cancelled',
                balance: invoice.balance,
                receivedAmount
            };
        }

        // Determine status based on payments
        let status: 'Unpaid' | 'Partial' | 'Paid' = 'Unpaid';
        let finalBalance = balance;

        if (receivedAmount === 0) {
            status = 'Unpaid';
        } else if (balance > 0.01) {
            status = 'Partial';
        } else {
            status = 'Paid';
            finalBalance = 0;
        }

        // Update invoice
        await db.invoice.update({
            where: { id: invoiceId },
            data: { status, balance: finalBalance }
        });

        console.log(`[AUDIT] Invoice ${invoice.invoiceNo} status recalculated: ${status}, balance: ₹${balance.toFixed(2)}, received: ₹${receivedAmount.toFixed(2)}`);

        return { status, balance, receivedAmount };
    }

    // Matching backend-v2 canReceivePayment (lines 154-180)
    async canReceivePayment(invoiceId: number): Promise<{ allowed: boolean; reason?: string }> {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId }
        });

        if (!invoice) {
            return { allowed: false, reason: 'Invoice not found' };
        }

        if (invoice.status === 'Draft') {
            return {
                allowed: false,
                reason: 'Cannot add payment to draft invoice. Please save the invoice first.'
            };
        }

        if (invoice.status === 'Cancelled') {
            return {
                allowed: false,
                reason: 'Cannot add payment to cancelled invoice. Please restore the invoice first.'
            };
        }

        return { allowed: true };
    }

    // Matching backend-v2 validateInvoiceTotalUpdate (lines 116-142)
    async validateInvoiceTotalUpdate(
        invoiceId: number,
        newTotal: number
    ): Promise<{ valid: boolean; error?: string; receivedAmount?: number }> {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { payments: true }
        });

        if (!invoice) {
            return { valid: false, error: 'Invoice not found' };
        }

        const receivedAmount = roundToTwoDecimals(
            invoice.payments.reduce((sum: any, p: any) => sum + p.amount, 0)
        );

        if (newTotal < receivedAmount) {
            return {
                valid: false,
                error: `Cannot reduce invoice total to ₹${newTotal.toFixed(2)} as ₹${receivedAmount.toFixed(2)} has already been paid. Please delete or adjust payments first.`,
                receivedAmount
            };
        }

        return { valid: true, receivedAmount };
    }
}
