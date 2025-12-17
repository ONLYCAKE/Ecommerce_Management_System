/**
 * Input Validation Schemas
 * 
 * Production security: Validates and sanitizes all API inputs
 * Uses Zod for strict type-safe validation
 */

import { z } from 'zod';

// ============================================
// INVOICE VALIDATION
// ============================================

/**
 * Invoice item schema
 */
export const InvoiceItemSchema = z.object({
    productId: z.number().int().positive().optional(),
    title: z.string().min(1, 'Item title is required').max(200),
    description: z.string().max(500).optional().nullable(),
    qty: z.number().int().positive('Quantity must be positive'),
    price: z.number().min(0, 'Price cannot be negative'),
    gst: z.number().min(0).max(100).default(0),
    discountPct: z.number().min(0).max(100).default(0),
    hsnCode: z.string().max(20).optional().nullable(),
});

/**
 * Payment entry schema (for invoice creation)
 */
export const PaymentEntrySchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    roundOff: z.number().default(0),
    mode: z.string().min(1).default('Cash'),
    note: z.string().max(200).optional(),
});

/**
 * Create invoice schema
 */
export const CreateInvoiceSchema = z.object({
    invoiceNo: z.string().min(1, 'Invoice number is required').max(50),
    buyerId: z.number().int().positive('Buyer is required'),
    paymentMethod: z.string().optional().nullable(),
    status: z.enum(['Draft', 'Processing', 'Unpaid', 'Partial', 'Paid', 'Cancelled']).optional(),
    items: z.array(InvoiceItemSchema).min(1, 'At least one item is required'),
    serviceCharge: z.number().min(0).default(0),
    payments: z.array(PaymentEntrySchema).optional().default([]),
    receivedAmount: z.number().min(0).optional().default(0),
    signature: z.string().optional().nullable(),
    invoiceDate: z.string().optional(),
    dueDate: z.string().optional(),
});

/**
 * Update invoice schema (similar but more permissive)
 */
export const UpdateInvoiceSchema = CreateInvoiceSchema.partial().extend({
    invoiceNo: z.string().optional(),
});

// ============================================
// PAYMENT VALIDATION
// ============================================

/**
 * Create payment schema
 */
export const CreatePaymentSchema = z.object({
    invoiceNo: z.string().min(1, 'Invoice number is required'),
    amount: z.number().positive('Amount must be positive'),
    method: z.string().min(1, 'Payment method is required'),
    reference: z.string().max(200).optional().nullable(),
});

/**
 * Update payment schema
 */
export const UpdatePaymentSchema = z.object({
    amount: z.number().positive('Amount must be positive').optional(),
    method: z.string().min(1).optional(),
    reference: z.string().max(200).optional().nullable(),
});

// ============================================
// EMAIL VALIDATION
// ============================================

/**
 * Send email schema
 */
export const SendEmailSchema = z.object({
    to: z.string().email('Valid email is required'),
    subject: z.string().min(1, 'Subject is required').max(200),
    htmlBody: z.string().min(1, 'Email body is required'),
});

// ============================================
// AUTH VALIDATION
// ============================================

/**
 * Login schema
 */
export const LoginSchema = z.object({
    email: z.string().email('Valid email is required'),
    password: z.string().min(1, 'Password is required'),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate request body with Zod schema
 * Returns validated data or throws validation error
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
        // Zod v3+ uses .issues not .errors
        const errorMessages = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ValidationError(errorMessages);
    }
    return result.data;
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

// Export type aliases for use in controllers
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof UpdatePaymentSchema>;
export type SendEmailInput = z.infer<typeof SendEmailSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
