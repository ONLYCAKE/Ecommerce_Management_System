import { prisma } from '../prisma.ts';
import { sendCustomInvoiceEmail } from './emailService.ts';

/**
 * Reminder Service
 * Handles sending invoice reminders with cooldown enforcement and audit logging
 */

// Cooldown period in milliseconds (default: 24 hours)
const COOLDOWN_MS = Number(process.env.REMINDER_COOLDOWN_HOURS || 24) * 60 * 60 * 1000;

interface SendReminderParams {
    invoiceId: number;
    userId: number;
}

interface ReminderResult {
    success: boolean;
    reminderId?: number;
    toEmail?: string;
    status?: string;
    error?: string;
}

/**
 * Check if a reminder can be sent (cooldown enforcement)
 */
export async function canSendReminder(invoiceId: number): Promise<{ allowed: boolean; reason?: string }> {
    const lastReminder = await prisma.invoiceReminder.findFirst({
        where: {
            invoiceId,
            status: 'sent'
        },
        orderBy: {
            sentAt: 'desc'
        }
    });

    if (!lastReminder || !lastReminder.sentAt) {
        return { allowed: true };
    }

    const timeSinceLastReminder = Date.now() - lastReminder.sentAt.getTime();

    if (timeSinceLastReminder < COOLDOWN_MS) {
        const hoursRemaining = Math.ceil((COOLDOWN_MS - timeSinceLastReminder) / (60 * 60 * 1000));
        return {
            allowed: false,
            reason: `Cooldown period not elapsed. Please wait ${hoursRemaining} more hour(s).`
        };
    }

    return { allowed: true };
}

/**
 * Send invoice reminder email
 */
export async function sendReminder({ invoiceId, userId }: SendReminderParams): Promise<ReminderResult> {
    try {
        // Fetch invoice with buyer data
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                buyer: true,
                supplier: true
            }
        });

        if (!invoice) {
            return { success: false, error: 'Invoice not found' };
        }

        // Check if invoice is pending
        if (invoice.status !== 'Pending' && invoice.status !== 'Processing') {
            return { success: false, error: 'Only pending invoices can have reminders sent' };
        }

        // Check if buyer has email
        if (!invoice.buyer?.email) {
            return { success: false, error: 'Buyer does not have a valid email address' };
        }

        // Check cooldown
        const cooldownCheck = await canSendReminder(invoiceId);
        if (!cooldownCheck.allowed) {
            return { success: false, error: cooldownCheck.reason };
        }

        // Create reminder record (queued status)
        const reminder = await prisma.invoiceReminder.create({
            data: {
                invoiceId,
                toEmail: invoice.buyer.email,
                status: 'queued',
                createdBy: userId
            }
        });

        try {
            // Prepare email content
            const subject = `Payment Reminder: Invoice ${invoice.invoiceNo}`;
            const htmlBody = generateReminderEmailHTML({
                customerName: invoice.buyer.name,
                invoiceNo: invoice.invoiceNo,
                amount: `₹${invoice.total.toFixed(2)}`,
                dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A',
                companyName: process.env.COMPANY_NAME || 'Uday Dairy'
            });

            // Generate PDF (placeholder for now)
            const pdfBuffer = Buffer.from('PDF placeholder');

            // Send email
            await sendCustomInvoiceEmail({
                to: invoice.buyer.email,
                subject,
                htmlBody,
                pdfBuffer,
                fileName: `${invoice.invoiceNo}.pdf`
            });

            // Update reminder status to sent
            await prisma.invoiceReminder.update({
                where: { id: reminder.id },
                data: {
                    status: 'sent',
                    sentAt: new Date(),
                    providerResponse: 'Email sent successfully'
                }
            });

            return {
                success: true,
                reminderId: reminder.id,
                toEmail: invoice.buyer.email,
                status: 'sent'
            };
        } catch (emailError: any) {
            // Update reminder status to failed
            await prisma.invoiceReminder.update({
                where: { id: reminder.id },
                data: {
                    status: 'failed',
                    providerResponse: emailError.message || 'Email sending failed'
                }
            });

            return {
                success: false,
                error: `Failed to send email: ${emailError.message}`
            };
        }
    } catch (error: any) {
        console.error('[ERROR] sendReminder:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}

/**
 * Send bulk reminders
 */
export async function sendBulkReminders(invoiceIds: number[], userId: number) {
    const results = {
        total: invoiceIds.length,
        succeeded: 0,
        failed: [] as Array<{ id: number; error: string }>
    };

    for (const invoiceId of invoiceIds) {
        const result = await sendReminder({ invoiceId, userId });

        if (result.success) {
            results.succeeded++;
        } else {
            results.failed.push({
                id: invoiceId,
                error: result.error || 'Unknown error'
            });
        }
    }

    return results;
}

/**
 * Get reminder history for an invoice
 */
export async function getReminderHistory(invoiceId: number) {
    const reminders = await prisma.invoiceReminder.findMany({
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
            createdAt: 'desc'
        }
    });

    return reminders.map(r => ({
        id: r.id,
        sentAt: r.sentAt,
        status: r.status,
        toEmail: r.toEmail,
        createdBy: r.user ? `${r.user.firstName} ${r.user.lastName}` : 'Unknown',
        providerResponse: r.providerResponse
    }));
}

/**
 * Generate reminder email HTML
 */
function generateReminderEmailHTML(data: {
    customerName: string;
    invoiceNo: string;
    amount: string;
    dueDate: string;
    companyName: string;
}): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Payment Reminder</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; margin: 0;">
  <div style="max-width: 600px; margin: auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <h2 style="color: #333; margin-bottom: 10px; margin-top: 0;">Payment Reminder</h2>

    <p style="color: #555; line-height: 1.6;">Dear ${data.customerName},</p>

    <p style="color: #555; line-height: 1.6;">This is a friendly reminder that your invoice <strong>${data.invoiceNo}</strong> is pending payment.</p>

    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 5px 0; color: #333;"><strong>Invoice Number:</strong> ${data.invoiceNo}</p>
      <p style="margin: 5px 0; color: #333;"><strong>Amount Due:</strong> ${data.amount}</p>
      <p style="margin: 5px 0; color: #333;"><strong>Due Date:</strong> ${data.dueDate}</p>
    </div>

    <p style="color: #555; line-height: 1.6;">Please find the invoice attached to this email for your reference.</p>

    <p style="color: #555; line-height: 1.6;">If you have already made the payment, please disregard this reminder.</p>

    <p style="color: #555; line-height: 1.6;">Thank you for your business!</p>

    <p style="color: #555; line-height: 1.6;">Best regards,<br><strong>${data.companyName}</strong></p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
    
    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
      This is an automated reminder. Please do not reply to this message.
    </p>
  </div>
</body>
</html>
  `;
}
