import type { Server } from 'socket.io';

let io: Server | null = null;

/**
 * Initialize the Socket.IO server instance
 * Called from server.ts during startup
 */
export function initializeEventService(socketServer: Server) {
    io = socketServer;
    console.log('✅ Event service initialized with Socket.IO');
}

/**
 * Get the Socket.IO instance
 */
function getIO(): Server {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeEventService first.');
    }
    return io;
}

/**
 * Emit invoice updated event
 */
export function emitInvoiceUpdated(invoiceId: number, data: any) {
    try {
        getIO().emit('invoice.updated', { invoiceId, ...data });
        console.log(`[EVENT] invoice.updated: ${invoiceId}`);
    } catch (error) {
        console.error('[EVENT ERROR] invoice.updated:', error);
    }
}

/**
 * Emit payment created event
 */
export function emitPaymentCreated(paymentId: number, invoiceId: number, data: any) {
    try {
        getIO().emit('payment.created', { paymentId, invoiceId, ...data });
        console.log(`[EVENT] payment.created: ${paymentId} for invoice ${invoiceId}`);
    } catch (error) {
        console.error('[EVENT ERROR] payment.created:', error);
    }
}

/**
 * Emit payment updated event
 */
export function emitPaymentUpdated(paymentId: number, invoiceId: number, data: any) {
    try {
        getIO().emit('payment.updated', { paymentId, invoiceId, ...data });
        console.log(`[EVENT] payment.updated: ${paymentId} for invoice ${invoiceId}`);
    } catch (error) {
        console.error('[EVENT ERROR] payment.updated:', error);
    }
}

/**
 * Emit payment deleted event
 */
export function emitPaymentDeleted(paymentId: number, invoiceId: number) {
    try {
        getIO().emit('payment.deleted', { paymentId, invoiceId });
        console.log(`[EVENT] payment.deleted: ${paymentId} for invoice ${invoiceId}`);
    } catch (error) {
        console.error('[EVENT ERROR] payment.deleted:', error);
    }
}
