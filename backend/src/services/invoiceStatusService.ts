import { prisma } from '../prisma';
import { roundToTwoDecimals } from '../config/roundOffConfig';
import { emitInvoiceUpdated } from './eventService';

export interface InvoiceStatusResult {
    status: 'Draft' | 'Unpaid' | 'Partial' | 'Paid' | 'Cancelled';
    balance: number;
    receivedAmount: number;
}

/**
 * SINGLE SOURCE OF TRUTH for invoice status calculation
 * 
 * This service is the ONLY place where invoice status and balance are calculated.
 * All payment operations (create/update/delete) MUST call this service.
 * 
 * Status Rules:
 * - Draft: Manually set for incomplete invoices, never recalculated
 * - Cancelled: Manually set, never recalculated
 * - Unpaid: receivedAmount === 0
 * - Partial: 0 < receivedAmount < total (with 0.01 tolerance)
 * - Paid: receivedAmount >= total
 * 
 * @param invoiceId - Invoice ID to recalculate
 * @param options - Transaction and emit control
 * @returns Calculated status, balance, and receivedAmount
 */
export async function recalculateAndUpdateInvoiceStatus(
    invoiceId: number,
    options: { skipEmit?: boolean; transaction?: any } = {}
): Promise<InvoiceStatusResult> {
    const db = options.transaction || prisma;

    // Fetch invoice with all payments
    const invoice = await db.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true }
    });

    if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
    }

    // Respect Draft status - don't recalculate
    if (invoice.status === 'Draft') {
        return {
            status: 'Draft',
            balance: invoice.balance,
            receivedAmount: 0
        };
    }

    // Calculate from payments (SINGLE SOURCE OF TRUTH)
    const receivedAmount = roundToTwoDecimals(
        invoice.payments.reduce((sum: number, p: any) => sum + p.amount, 0)
    );
    const balance = roundToTwoDecimals(invoice.total - receivedAmount);

    // Determine status based on payments
    let status: 'Unpaid' | 'Partial' | 'Paid' = 'Unpaid';
    let finalBalance = balance;

    if (receivedAmount === 0) {
        status = 'Unpaid';
    } else if (balance > 0.01) {  // Tolerance for rounding errors
        status = 'Partial';
    } else {
        status = 'Paid';
        finalBalance = 0; // ✅ Set to exactly 0 when Paid
    }

    // Update invoice (single atomic operation)
    await db.invoice.update({
        where: { id: invoiceId },
        data: {
            status,
            balance: finalBalance
        }
    });

    // Emit event (unless suppressed for transaction batching)
    if (!options.skipEmit) {
        emitInvoiceUpdated(invoiceId, { status, balance, receivedAmount });
    }

    // Audit log
    console.log(`[AUDIT] Invoice ${invoice.invoiceNo} status recalculated: ${status}, balance: ₹${balance.toFixed(2)}, received: ₹${receivedAmount.toFixed(2)}`);

    return { status, balance, receivedAmount };
}

/**
 * Validate that invoice total is not reduced below total payments
 * 
 * Prevents data inconsistency where paid amount exceeds invoice total.
 * MUST be called before updating invoice.total
 * 
 * @param invoiceId - Invoice ID to validate
 * @param newTotal - Proposed new total
 * @returns Validation result with error message if invalid
 */
export async function validateInvoiceTotalUpdate(
    invoiceId: number,
    newTotal: number
): Promise<{ valid: boolean; error?: string; receivedAmount?: number }> {
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true }
    });

    if (!invoice) {
        return { valid: false, error: 'Invoice not found' };
    }

    const receivedAmount = roundToTwoDecimals(
        invoice.payments.reduce((sum, p) => sum + p.amount, 0)
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

/**
 * Check if invoice can receive payments
 * 
 * Validates business rules:
 * - Invoice must exist
 * - Invoice cannot be cancelled
 * 
 * @param invoiceId - Invoice ID to check
 * @returns Whether payment is allowed and reason if not
 */
export async function canReceivePayment(
    invoiceId: number
): Promise<{ allowed: boolean; reason?: string }> {
    const invoice = await prisma.invoice.findUnique({
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

/**
 * Validate invoice can be updated
 * 
 * Business rules:
 * - Cannot update cancelled invoices
 * - Cannot manually change status
 * 
 * @param invoiceId - Invoice ID to validate
 * @param updates - Proposed updates
 * @returns Validation result
 */
export async function validateInvoiceUpdate(
    invoiceId: number,
    updates: { status?: string; total?: number }
): Promise<{ valid: boolean; error?: string }> {
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true }
    });

    if (!invoice) {
        return { valid: false, error: 'Invoice not found' };
    }

    // Cannot update cancelled invoices
    if (invoice.status === 'Cancelled') {
        return {
            valid: false,
            error: 'Cannot update cancelled invoice. Please restore it first using the cancel/restore feature.'
        };
    }

    // Cannot manually change status
    if (updates.status && updates.status !== invoice.status) {
        return {
            valid: false,
            error: 'Status cannot be changed manually. It is automatically calculated based on payments.'
        };
    }

    // Validate total reduction
    if (updates.total !== undefined && updates.total !== invoice.total) {
        const totalValidation = await validateInvoiceTotalUpdate(invoiceId, updates.total);
        if (!totalValidation.valid) {
            return totalValidation;
        }
    }

    return { valid: true };
}
