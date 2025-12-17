import type { Request, Response } from 'express'
import { prisma } from '../prisma'
import {
    emitPaymentCreated,
    emitPaymentUpdated,
    emitPaymentDeleted
} from '../services/eventService'
import { roundToTwoDecimals } from '../config/roundOffConfig'
import {
    recalculateAndUpdateInvoiceStatus,
    canReceivePayment
} from '../services/invoiceStatusService'

/* ----------------------------- CREATE PAYMENT ----------------------------- */
export const createPayment = async (req: Request, res: Response) => {
    try {
        const { invoiceNo, amount, method, reference } = req.body
        const userId = (req as any).user?.id

        if (!invoiceNo || amount === undefined || !method) {
            return res.status(400).json({ message: 'Missing required fields' })
        }

        const paymentAmount = roundToTwoDecimals(Number(amount))
        if (paymentAmount <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than 0' })
        }

        const invoice = await prisma.invoice.findUnique({
            where: { invoiceNo },
            include: { payments: true }
        })

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' })
        }

        const canPay = await canReceivePayment(invoice.id)
        if (!canPay.allowed) {
            return res.status(400).json({ message: canPay.reason })
        }

        const receivedAmount = roundToTwoDecimals(
            invoice.payments.reduce((sum, p) => sum + p.amount, 0)
        )

        const remainingBalance = roundToTwoDecimals(
            invoice.total - receivedAmount
        )

        if (paymentAmount > remainingBalance) {
            return res.status(400).json({
                message: `Payment amount exceeds remaining balance (₹${remainingBalance.toFixed(2)})`
            })
        }

        const payment = await prisma.$transaction(async (tx) => {
            const pmt = await tx.payment.create({
                data: {
                    invoiceId: invoice.id,
                    amount: paymentAmount,
                    method,
                    reference: reference || null,
                    createdBy: userId
                }
            })

            await recalculateAndUpdateInvoiceStatus(invoice.id, {
                skipEmit: true,
                transaction: tx
            })

            return pmt
        })

        emitPaymentCreated(payment.id, invoice.id, {
            amount: payment.amount,
            method: payment.method,
            invoiceNo: invoice.invoiceNo
        })

        // Status was already recalculated inside the transaction
        // Emit the updated status to clients
        await recalculateAndUpdateInvoiceStatus(invoice.id)

        res.status(201).json(payment)
    } catch (err: any) {
        console.error('[ERROR] createPayment:', err)
        res.status(500).json({ message: 'Failed to create payment', error: err.message })
    }
}

/* ----------------------------- UPDATE PAYMENT ----------------------------- */
export const updatePayment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const { amount, method, reference } = req.body

        const existing = await prisma.payment.findUnique({
            where: { id: Number(id) },
            include: { invoice: { include: { payments: true } } }
        })

        if (!existing) {
            return res.status(404).json({ message: 'Payment not found' })
        }

        let updatedAmount: number | undefined

        if (amount !== undefined) {
            updatedAmount = roundToTwoDecimals(Number(amount))
            if (updatedAmount <= 0) {
                return res.status(400).json({ message: 'Amount must be greater than 0' })
            }

            const otherPaymentsTotal = roundToTwoDecimals(
                existing.invoice.payments
                    .filter(p => p.id !== existing.id)
                    .reduce((sum, p) => sum + p.amount, 0)
            )

            const remainingBalance = roundToTwoDecimals(
                existing.invoice.total - otherPaymentsTotal
            )

            if (updatedAmount > remainingBalance) {
                return res.status(400).json({
                    message: `Payment amount exceeds remaining balance (₹${remainingBalance.toFixed(2)})`
                })
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            const pmt = await tx.payment.update({
                where: { id: Number(id) },
                data: {
                    amount: updatedAmount,
                    method: method || undefined,
                    reference: reference !== undefined ? reference : undefined
                }
            })

            await recalculateAndUpdateInvoiceStatus(existing.invoiceId, {
                skipEmit: true,
                transaction: tx
            })

            return pmt
        })

        emitPaymentUpdated(updated.id, existing.invoiceId, {
            amount: updated.amount,
            method: updated.method,
            invoiceNo: existing.invoice.invoiceNo
        })

        await recalculateAndUpdateInvoiceStatus(existing.invoiceId)

        res.json(updated)
    } catch (err: any) {
        console.error('[ERROR] updatePayment:', err)
        res.status(500).json({ message: 'Failed to update payment', error: err.message })
    }
}

/* ----------------------------- DELETE PAYMENT ----------------------------- */
export const deletePayment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params

        const existing = await prisma.payment.findUnique({
            where: { id: Number(id) },
            include: { invoice: true }
        })

        if (!existing) {
            return res.status(404).json({ message: 'Payment not found' })
        }

        await prisma.$transaction(async (tx) => {
            await tx.payment.delete({
                where: { id: Number(id) }
            })

            await recalculateAndUpdateInvoiceStatus(existing.invoiceId, {
                skipEmit: true,
                transaction: tx
            })
        })

        emitPaymentDeleted(Number(id), existing.invoiceId)

        res.json({ message: 'Payment deleted successfully' })
    } catch (err: any) {
        console.error('[ERROR] deletePayment:', err)
        res.status(500).json({ message: 'Failed to delete payment', error: err.message })
    }
}

/* ----------------------------- GET PAYMENTS BY INVOICE ----------------------------- */
export const getPaymentsByInvoice = async (req: Request, res: Response) => {
    try {
        const { invoiceNo } = req.params

        const invoice = await prisma.invoice.findUnique({
            where: { invoiceNo }
        })

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' })
        }

        const payments = await prisma.payment.findMany({
            where: { invoiceId: invoice.id },
            include: {
                user: { select: { firstName: true, lastName: true, email: true } }
            },
            orderBy: { receivedAt: 'desc' }
        })

        res.json(payments)
    } catch (err: any) {
        console.error('[ERROR] getPaymentsByInvoice:', err)
        res.status(500).json({ message: 'Failed to fetch payments', error: err.message })
    }
}

/* ----------------------------- GET ALL PAYMENT RECORDS ----------------------------- */
export const getAllPaymentRecords = async (_req: Request, res: Response) => {
    try {
        const payments = await prisma.payment.findMany({
            include: {
                invoice: {
                    select: {
                        invoiceNo: true,
                        total: true,
                        balance: true,
                        status: true
                    }
                },
                user: {
                    select: { firstName: true, lastName: true }
                }
            },
            orderBy: { receivedAt: 'desc' }
        })

        const result = payments.map(p => ({
            id: p.id,
            invoiceId: p.invoiceId,      // For internal relations/navigation
            invoiceNo: p.invoice.invoiceNo, // For display purposes
            paymentDate: p.receivedAt,
            paidAmount: p.amount,
            remainingBalance: p.invoice.balance,
            paymentMethod: p.method,
            reference: p.reference || '-',
            addedBy: p.user
                ? `${p.user.firstName} ${p.user.lastName}`
                : 'System',
            invoiceTotal: p.invoice.total,
            invoiceStatus: p.invoice.status
        }))

        res.json(result)
    } catch (err: any) {
        console.error('[ERROR] getAllPaymentRecords:', err)
        res.status(500).json({ message: 'Failed to fetch payment records', error: err.message })
    }
}
