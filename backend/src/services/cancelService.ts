import { prisma } from '../prisma.ts';

/**
 * Cancel Service
 * Handles invoice cancellation with audit logging and validation
 */

interface CancelInvoiceParams {
    invoiceId: number;
    userId: number;
    reason: string;
    force?: boolean;
}

interface CancelResult {
    success: boolean;
    invoiceId?: number;
    status?: string;
    error?: string;
}

/**
 * Validate if an invoice can be cancelled
 */
export async function validateCancellation(
    invoice: any,
    force: boolean,
    isAdmin: boolean
): Promise<{ allowed: boolean; reason?: string }> {
    // Check if invoice is already cancelled
    if (invoice.status === 'Cancelled') {
        return { allowed: false, reason: 'Invoice is already cancelled' };
    }

    // Check if invoice is paid
    if (invoice.status === 'Paid' || invoice.status === 'Completed') {
        if (!force) {
            return {
                allowed: false,
                reason: 'Cannot cancel a paid invoice. Use force option if you have admin privileges.'
            };
        }

        if (!isAdmin) {
            return {
                allowed: false,
                reason: 'Only administrators can force-cancel paid invoices'
            };
        }
    }

    return { allowed: true };
}

/**
 * Cancel an invoice
 */
export async function cancelInvoice({
    invoiceId,
    userId,
    reason,
    force = false
}: CancelInvoiceParams): Promise<CancelResult> {
    try {
        // Fetch invoice
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId }
        });

        if (!invoice) {
            return { success: false, error: 'Invoice not found' };
        }

        // Fetch user to check if admin
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                role: {
                    include: {
                        rolePermissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }
            }
        });

        const isAdmin = user?.role?.name === 'SuperAdmin' || user?.role?.name === 'Admin';

        // Validate cancellation
        const validation = await validateCancellation(invoice, force, isAdmin);
        if (!validation.allowed) {
            return { success: false, error: validation.reason };
        }

        // Update invoice status
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                status: 'Cancelled',
                cancelledAt: new Date(),
                cancelledBy: userId
            }
        });

        // Create cancel log
        await prisma.cancelLog.create({
            data: {
                invoiceId,
                cancelledBy: userId,
                reason,
                forceCancelled: force
            }
        });

        return {
            success: true,
            invoiceId,
            status: 'Cancelled'
        };
    } catch (error: any) {
        console.error('[ERROR] cancelInvoice:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}

/**
 * Get cancel history for an invoice
 */
export async function getCancelHistory(invoiceId: number) {
    const logs = await prisma.cancelLog.findMany({
        where: { invoiceId },
        include: {
            user: {
                select: {
                    firstName: true,
                    lastName: true,
                    email: true
                }
            }
        },
        orderBy: {
            cancelledAt: 'desc'
        }
    });

    return logs.map(log => ({
        id: log.id,
        cancelledAt: log.cancelledAt,
        cancelledBy: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Unknown',
        reason: log.reason,
        forceCancelled: log.forceCancelled
    }));
}
