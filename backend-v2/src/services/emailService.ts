import nodemailer from 'nodemailer';

/**
 * Email Service using Mailtrap SMTP with API Token
 * Sends invoice PDFs to buyers via email
 */

// Create SMTP transport for Mailtrap with API token
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
  port: Number(process.env.SMTP_PORT) || 2525,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

interface SendInvoiceEmailParams {
  to: string;
  pdfBuffer: Buffer;
  fileName: string;
}

/**
 * Send invoice email with PDF attachment
 * @param to - Recipient email address
 * @param pdfBuffer - PDF file as Buffer
 * @param fileName - Name of the PDF file (e.g., "INV-001.pdf")
 */
export async function sendInvoiceEmail({
  to,
  pdfBuffer,
  fileName,
}: SendInvoiceEmailParams): Promise<void> {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'Uday Dairy <no-reply@udaydairy.com>',
    to,
    subject: 'Your Invoice from Uday Dairy',

    // HTML email body
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🧾 Invoice from Uday Dairy</h1>
            </div>
            <div class="content">
              <p>Dear Valued Customer,</p>
              <p>Thank you for your business! Please find your invoice attached to this email.</p>
              <p><strong>Invoice Details:</strong></p>
              <ul>
                <li>File Name: ${fileName}</li>
                <li>Format: PDF</li>
              </ul>
              <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
              <p>Best regards,<br><strong>Uday Dairy Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} Uday Dairy. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,

    // Plain text version
    text: `
Dear Valued Customer,

Thank you for your business! Please find your invoice (${fileName}) attached to this email.

If you have any questions about this invoice, please don't hesitate to contact us.

Best regards,
Uday Dairy Team

---
This is an automated email. Please do not reply to this message.
© ${new Date().getFullYear()} Uday Dairy. All rights reserved.
    `,

    // PDF attachment
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log('✅ Invoice email sent successfully');
    console.log('   Message ID:', info.messageId);
    console.log('   Recipient:', to);
    console.log('   File:', fileName);
  } catch (error) {
    console.error('❌ Failed to send invoice email:', error);
    throw error;
  }
}

/**
 * Send custom invoice email with user-provided HTML content
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param htmlBody - Custom HTML email body
 * @param pdfBuffer - PDF file as Buffer
 * @param fileName - Name of the PDF file
 */
export async function sendCustomInvoiceEmail({
  to,
  subject,
  htmlBody,
  pdfBuffer,
  fileName,
}: {
  to: string;
  subject: string;
  htmlBody: string;
  pdfBuffer: Buffer;
  fileName: string;
}): Promise<void> {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'Uday Dairy <no-reply@udaydairy.com>',
    to,
    subject,
    html: htmlBody,
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log('✅ Custom invoice email sent successfully');
    console.log('   Message ID:', info.messageId);
    console.log('   Recipient:', to);
    console.log('   Subject:', subject);
    console.log('   File:', fileName);
  } catch (error) {
    console.error('❌ Failed to send custom invoice email:', error);
    throw error;
  }
}

/**
 * Generate a placeholder PDF buffer for testing
 * In production, replace this with actual PDF generation using pdfkit or puppeteer
 */
export function generatePlaceholderPDF(invoiceNo: string, res?: any): Buffer {
  const pdfContent = `
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 100
>>
stream
BT
/F1 24 Tf
100 700 Td
(Invoice: ${invoiceNo}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000317 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
467
%%EOF
  `;

  return Buffer.from(pdfContent.trim());
}
