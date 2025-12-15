import type { Request, Response } from 'express';
import { prisma } from '../prisma';
import {
    emitPaymentCreated,
    emitPaymentUpdated,
    emitPaymentDeleted,
    emitInvoiceUpdated
} from '../services/eventService';
import { calculateRoundOff, roundToTwoDecimals } from '../config/roundOffConfig';

/**
 * Recalculate invoice status based on payments
 * Status logic:
 * - received_amount == 0 → Unpaid
 * - 0 < received_amount < total → Partial
 * - received_amount >= total → Paid
 */
async function recalculateInvoiceStatus(invoiceId: number) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true }
    });

    if (!invoice) return;

    // Calculate received amount including round-off
    const receivedAmount = roundToTwoDecimals(
        invoice.payments.reduce((sum, p) => sum + p.amount, 0)
    );
    const balance = roundToTwoDecimals(invoice.total - receivedAmount);

    let status = 'Unpaid';
    if (receivedAmount === 0) {
        status = 'Unpaid';
    } else if (balance > 0.01) {  // Consider paid if balance is effectively zero
        status = 'Partial';
    } else {
        status = 'Paid';
    }

    await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status, balance: balance < 0.01 ? 0 : balance }
    });

    // Emit invoice updated event
    emitInvoiceUpdated(invoiceId, { status, balance, receivedAmount });
}

/* ----------------------------- CREATE PAYMENT ----------------------------- */
export const createPayment = async (req: Request, res: Response) => {
    try {
        const { invoiceNo, amount, method, reference } = req.body;
        const userId = (req as any).user?.id;

        // Validation
        if (!invoiceNo || !amount || !method) {
            return res.status(400).json({ message: 'Missing required fields: invoiceNo, amount, method' });
        }

        if (amount <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than 0' });
        }

        // Find invoice
        const invoice = await prisma.invoice.findUnique({
            where: { invoiceNo },
            include: { payments: true }
        });

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Calculate remaining balance with proper rounding
        const receivedAmount = roundToTwoDecimals(
            invoice.payments.reduce((sum, p) => sum + p.amount, 0)
        );
        const remainingBalance = roundToTwoDecimals(invoice.total - receivedAmount);
        const paymentAmount = roundToTwoDecimals(Number(amount));

        // Calculate round-off if applicable
        const { adjustedAmount, roundOff, shouldApplyRoundOff } = calculateRoundOff(
            paymentAmount,
            remainingBalance
        );

        // Validate payment amount (with round-off consideration)
        if (!shouldApplyRoundOff && paymentAmount > remainingBalance) {
            return res.status(400).json({
                message: `Payment amount (₹${paymentAmount.toFixed(2)}) exceeds remaining balance (₹${remainingBalance.toFixed(2)})`
            });
        }

        // Create payment with round-off
        const payment = await prisma.payment.create({
            data: {
                invoiceId: invoice.id,
                amount: adjustedAmount,
                roundOff: roundOff,
                method,
                reference: reference || null,
                createdBy: userId
            }
        });

        // Recalculate invoice status
        await recalculateInvoiceStatus(invoice.id);

        // Emit payment created event
        emitPaymentCreated(payment.id, invoice.id, {
            amount: payment.amount,
            roundOff: payment.roundOff,
            method: payment.method,
            invoiceNo: invoice.invoiceNo
        });

        res.status(201).json(payment);
    } catch (err: any) {
        console.error('[ERROR] createPayment:', err);
        res.status(500).json({ message: 'Failed to create payment', error: err.message });
    }
};

/* ----------------------------- UPDATE PAYMENT ----------------------------- */
export const updatePayment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { amount, method, reference } = req.body;

        // Find existing payment
        const existing = await prisma.payment.findUnique({
            where: { id: Number(id) },
            include: { invoice: { include: { payments: true } } }
        });

        if (!existing) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        // Validation
        if (amount && amount <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than 0' });
        }

        // Check if updated amount exceeds balance
        if (amount) {
            const otherPayments = existing.invoice.payments.filter(p => p.id !== existing.id);
            const otherTotal = otherPayments.reduce((sum, p) => sum + p.amount, 0);
            const remainingBalance = existing.invoice.total - otherTotal;

            if (amount > remainingBalance) {
                return res.status(400).json({
                    message: `Payment amount (₹${amount}) exceeds remaining balance (₹${remainingBalance})`
                });
            }
        }

        // Update payment
        const updated = await prisma.payment.update({
            where: { id: Number(id) },
            data: {
                amount: amount ? Number(amount) : undefined,
                method: method || undefined,
                reference: reference !== undefined ? reference : undefined
            }
        });

        // Recalculate invoice status
        await recalculateInvoiceStatus(existing.invoiceId);

        // Emit payment updated event
        emitPaymentUpdated(updated.id, existing.invoiceId, {
            amount: updated.amount,
            method: updated.method,
            invoiceNo: existing.invoice.invoiceNo
        });

        res.json(updated);
    } catch (err: any) {
        console.error('[ERROR] updatePayment:', err);
        res.status(500).json({ message: 'Failed to update payment', error: err.message });
    }
};

/* ----------------------------- DELETE PAYMENT ----------------------------- */
export const deletePayment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Find existing payment
        const existing = await prisma.payment.findUnique({
            where: { id: Number(id) },
            include: { invoice: true }
        });

        if (!existing) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        // Delete payment
        await prisma.payment.delete({
            where: { id: Number(id) }
        });

        // Recalculate invoice status
        await recalculateInvoiceStatus(existing.invoiceId);

        // Emit payment deleted event
        emitPaymentDeleted(Number(id), existing.invoiceId);

        res.json({ message: 'Payment deleted successfully' });
    } catch (err: any) {
        console.error('[ERROR] deletePayment:', err);
        res.status(500).json({ message: 'Failed to delete payment', error: err.message });
    }
};

/* ----------------------------- GET PAYMENTS BY INVOICE ----------------------------- */
export const getPaymentsByInvoice = async (req: Request, res: Response) => {
    try {
        const { invoiceNo } = req.params;

        // Find invoice
        const invoice = await prisma.invoice.findUnique({
            where: { invoiceNo }
        });

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Get payments
        const payments = await prisma.payment.findMany({
            where: { invoiceId: invoice.id },
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
            orderBy: { receivedAt: 'desc' }
        });

        res.json(payments);
    } catch (err: any) {
        console.error('[ERROR] getPaymentsByInvoice:', err);
        res.status(500).json({ message: 'Failed to fetch payments', error: err.message });
    }
};
