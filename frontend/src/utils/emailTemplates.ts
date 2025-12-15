/**
 * Email Template Utilities
 * Handles email template generation, placeholder replacement, and HTML conversion
 */

export interface InvoiceEmailData {
    invoiceNumber: string;
    buyerName: string;
    invoiceTotal: string;
    dueDate: string;
    companyName: string;
}

/**
 * Get default email template (clean text version shown in UI)
 */
export function getDefaultTemplate(): string {
    return `Invoice {{invoiceNumber}}

Dear {{buyerName}},

Please find attached your invoice for review.

Invoice Summary:
- Total Amount: {{invoiceTotal}}
- Due Date: {{dueDate}}

Thank you for your business!

Best regards,
{{companyName}}`;
}

/**
 * Replace placeholders in template with actual data
 */
export function replacePlaceholders(template: string, data: InvoiceEmailData): string {
    return template
        .replace(/\{\{invoiceNumber\}\}/g, data.invoiceNumber)
        .replace(/\{\{buyerName\}\}/g, data.buyerName)
        .replace(/\{\{invoiceTotal\}\}/g, data.invoiceTotal)
        .replace(/\{\{dueDate\}\}/g, data.dueDate)
        .replace(/\{\{companyName\}\}/g, data.companyName);
}

/**
 * Convert plain text template to professional HTML email
 */
export function convertToHTML(plainText: string, data: InvoiceEmailData): string {
    // First replace placeholders in plain text
    const filled = replacePlaceholders(plainText, data);

    // Convert to HTML with professional styling
    const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${data.invoiceNumber}</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; margin: 0;">
  <div style="max-width: 600px; margin: auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <h2 style="color: #333; margin-bottom: 10px; margin-top: 0;">Invoice ${data.invoiceNumber}</h2>

    <p style="color: #555; line-height: 1.6;">Dear ${data.buyerName},</p>

    <p style="color: #555; line-height: 1.6;">Please find your invoice attached for your review.</p>

    <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4CAF50;">
      <p style="margin: 5px 0; color: #333;"><strong>Total:</strong> ${data.invoiceTotal}</p>
      <p style="margin: 5px 0; color: #333;"><strong>Due Date:</strong> ${data.dueDate}</p>
    </div>

    <p style="color: #555; line-height: 1.6;">Thank you for your business!</p>

    <p style="color: #555; line-height: 1.6;">Best regards,<br><strong>${data.companyName}</strong></p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
    
    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
      This is an automated email. Please do not reply to this message.
    </p>
  </div>
</body>
</html>`;

    return htmlTemplate;
}

/**
 * Get default email subject
 */
export function getDefaultSubject(invoiceNumber: string, companyName: string): string {
    return `Invoice ${invoiceNumber}: ${companyName}`;
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
