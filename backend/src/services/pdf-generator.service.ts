import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Design constants
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
    primary: '#1a1a2e',
    secondary: '#16213e',
    accent: '#0f3460',
    text: '#333333',
    textLight: '#666666',
    border: '#e0e0e0',
    headerBg: '#f8f9fa',
    white: '#ffffff'
};

const money = (n: number) => `₹${Number(n || 0).toFixed(2)}`;
const formatDate = (d: Date | string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });

export async function generateInvoicePdfContent(inv: any, res: Response) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${inv.invoiceNo}.pdf"`);

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 50 } as any);
    doc.pipe(res as any);

    let y = MARGIN;

    // ========== COMPANY HEADER WITH LOGO ==========
    try {
        const logoPath = path.join(process.cwd(), 'public', 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, MARGIN, y, { width: 55, height: 55 });
        }
    } catch (err) {
        // Logo not found, continue without it
    }

    // Company name and details (beside logo)
    const companyTextX = MARGIN + 65;
    doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(15);
    doc.text('UDAY DAIRY EQUIPMENTS', companyTextX, y + 5);

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text('GSTIN: 24AADFU1188L1ZX', companyTextX, y + 22);
    doc.text('48/B, Vijay Plaza Complex, Kankariya Road, Near Parsi Agyan', companyTextX, y + 32);
    doc.text('Ahmedabad - 380022 | Ph: 9974396581 | udaydairyequipments@gmail.com', companyTextX, y + 42);

    // Invoice title - right aligned (prominent)
    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.primary);
    doc.text('TAX INVOICE', PAGE_WIDTH - MARGIN - 130, y + 15, { width: 130, align: 'right' });

    y += 65;

    // Divider
    doc.strokeColor(COLORS.border).lineWidth(1);
    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();

    y += 15;

    // ========== INVOICE META & BILL TO (Two columns) ==========
    const leftColX = MARGIN;
    const rightColX = PAGE_WIDTH - MARGIN - 200;
    const buyer = inv.buyer as any;

    // Left: Bill To
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text);
    doc.text('Bill To:', leftColX, y);

    y += 14;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primary);
    doc.text(buyer?.name || 'Customer', leftColX, y);

    y += 14;
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.textLight);

    const addressParts = [buyer?.addressLine1, buyer?.addressLine2, buyer?.city, buyer?.state].filter(Boolean);
    if (addressParts.length > 0) {
        doc.text(addressParts.join(', '), leftColX, y, { width: 250 });
        y += 12;
    }
    if (buyer?.phone) { doc.text(`Phone: ${buyer.phone}`, leftColX, y); y += 12; }
    if (buyer?.gstin) { doc.text(`GSTIN: ${buyer.gstin}`, leftColX, y); y += 12; }

    // Right: Invoice Details (positioned at fixed Y)
    const metaY = y - 52;
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);

    doc.text('Invoice No:', rightColX, metaY);
    doc.font('Helvetica-Bold').text(inv.invoiceNo, rightColX + 70, metaY);

    doc.font('Helvetica').text('Date:', rightColX, metaY + 14);
    doc.font('Helvetica-Bold').text(formatDate(inv.createdAt), rightColX + 70, metaY + 14);

    doc.font('Helvetica').text('Due Date:', rightColX, metaY + 28);
    doc.font('Helvetica-Bold').text(formatDate(inv.dueDate || inv.createdAt), rightColX + 70, metaY + 28);

    doc.font('Helvetica').text('Place of Supply:', rightColX, metaY + 42);
    doc.font('Helvetica-Bold').text(buyer?.state || 'Gujarat', rightColX + 70, metaY + 42);

    y = Math.max(y, metaY + 60) + 20;

    // ========== ITEMS TABLE ==========
    const tableTop = y;
    const rowHeight = 24;

    // Column positions
    const cols = {
        no: MARGIN,
        item: MARGIN + 25,
        rate: MARGIN + 250,
        qty: MARGIN + 340,
        taxable: MARGIN + 400
    };
    const colWidths = {
        no: 20,
        item: 220,
        rate: 85,
        qty: 55,
        taxable: 95
    };

    // Table header with background
    doc.rect(MARGIN, tableTop, CONTENT_WIDTH, rowHeight).fill(COLORS.headerBg);
    doc.strokeColor(COLORS.border).rect(MARGIN, tableTop, CONTENT_WIDTH, rowHeight).stroke();

    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9);
    doc.text('#', cols.no + 5, tableTop + 8);
    doc.text('Item (HSN/Desc)', cols.item, tableTop + 8);
    doc.text('Rate / item', cols.rate, tableTop + 8, { width: colWidths.rate, align: 'right' });
    doc.text('Qty', cols.qty, tableTop + 8, { width: colWidths.qty, align: 'center' });
    doc.text('Taxable Value', cols.taxable, tableTop + 8, { width: colWidths.taxable, align: 'right' });

    y = tableTop + rowHeight;

    // Table rows
    let taxableTotal = 0;
    let totalTax = 0;

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);

    (inv.items as any[]).forEach((item, i) => {
        const qty = Number(item.qty) || 1;
        const price = Number(item.price) || 0;
        const gst = Number(item.gst) || 0;
        const lineTotal = price * qty;
        const lineTax = lineTotal * (gst / 100);
        const lineTaxable = lineTotal + lineTax;

        taxableTotal += lineTotal;
        totalTax += lineTax;

        // Row border
        doc.strokeColor(COLORS.border).rect(MARGIN, y, CONTENT_WIDTH, rowHeight).stroke();

        // Row content
        doc.fillColor(COLORS.text);
        doc.text((i + 1).toString(), cols.no + 5, y + 8);

        // Item with HSN
        const hsnText = item.hsnCode ? ` (${item.hsnCode})` : '';
        doc.text(`${item.title || 'Product'}${hsnText}`, cols.item, y + 8, { width: colWidths.item - 10, ellipsis: true });

        doc.text(money(price), cols.rate, y + 8, { width: colWidths.rate, align: 'right' });
        doc.text(`${qty} pcs`, cols.qty, y + 8, { width: colWidths.qty, align: 'center' });
        doc.text(money(lineTaxable), cols.taxable, y + 8, { width: colWidths.taxable, align: 'right' });

        y += rowHeight;
    });

    // ========== TOTALS ==========
    const totalsStartX = cols.rate;
    const totalsLabelWidth = cols.taxable - cols.rate - 5;
    const totalsValueWidth = colWidths.taxable + 5;
    const totalsRowHeight = 22;

    const grandTotal = Number(inv.total);
    const sgst = totalTax / 2;
    const cgst = totalTax / 2;

    const totalReceived = (inv.payments as any[] || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const balance = grandTotal - totalReceived;

    // Taxable Amount row
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    doc.text('Taxable Amount:', totalsStartX, y + 5, { width: totalsLabelWidth, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(money(taxableTotal), totalsStartX + totalsLabelWidth + 5, y + 5, { width: totalsValueWidth, align: 'right' });
    y += totalsRowHeight;

    // SGST row
    doc.font('Helvetica').fontSize(9);
    doc.text('SGST @ 9%:', totalsStartX, y + 5, { width: totalsLabelWidth, align: 'right' });
    doc.font('Helvetica-Bold');
    doc.text(money(sgst), totalsStartX + totalsLabelWidth + 5, y + 5, { width: totalsValueWidth, align: 'right' });
    y += totalsRowHeight;

    // CGST row
    doc.font('Helvetica').fontSize(9);
    doc.text('CGST @ 9%:', totalsStartX, y + 5, { width: totalsLabelWidth, align: 'right' });
    doc.font('Helvetica-Bold');
    doc.text(money(cgst), totalsStartX + totalsLabelWidth + 5, y + 5, { width: totalsValueWidth, align: 'right' });
    y += totalsRowHeight;

    // ========== EXTRA CHARGES ==========
    const grandTotalBoxWidth = totalsLabelWidth + totalsValueWidth + 15;
    const extraCharges = (inv as any).extraCharges as any[] || [];
    let extraChargesTotal = 0;

    if (extraCharges.length > 0) {
        doc.strokeColor(COLORS.border).lineWidth(0.5);
        doc.moveTo(totalsStartX - 5, y).lineTo(totalsStartX + grandTotalBoxWidth - 10, y).stroke();
        y += 8;

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#92400e');
        doc.text('Additional Charges:', totalsStartX, y + 5, { width: totalsLabelWidth, align: 'right' });
        y += totalsRowHeight - 4;

        doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
        extraCharges.forEach((charge: any) => {
            if (charge.name && charge.amount) {
                doc.text(`  ${charge.name}:`, totalsStartX, y + 5, { width: totalsLabelWidth, align: 'right' });
                doc.font('Helvetica-Bold');
                doc.text(money(charge.amount), totalsStartX + totalsLabelWidth + 5, y + 5, { width: totalsValueWidth, align: 'right' });
                doc.font('Helvetica');
                extraChargesTotal += Number(charge.amount);
                y += totalsRowHeight - 4;
            }
        });

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#92400e');
        doc.text('Total Additional:', totalsStartX, y + 5, { width: totalsLabelWidth, align: 'right' });
        doc.text(money(extraChargesTotal), totalsStartX + totalsLabelWidth + 5, y + 5, { width: totalsValueWidth, align: 'right' });
        y += totalsRowHeight;
    }

    const finalGrandTotal = grandTotal + extraChargesTotal;

    // Grand Total row
    doc.rect(totalsStartX - 5, y, grandTotalBoxWidth, 24).fill('#e8f4fd');
    doc.strokeColor(COLORS.border).rect(totalsStartX - 5, y, grandTotalBoxWidth, 24).stroke();
    doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(10);
    doc.text('Grand Total:', totalsStartX, y + 6, { width: totalsLabelWidth, align: 'right' });
    doc.fontSize(11);
    doc.text(money(finalGrandTotal), totalsStartX + totalsLabelWidth + 5, y + 5, { width: totalsValueWidth, align: 'right' });
    y += 28;

    // Amount Payable
    if (balance !== grandTotal && balance > 0) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary);
        doc.text('Amount Payable:', totalsStartX, y + 5, { width: totalsLabelWidth, align: 'right' });
        doc.text(money(balance), totalsStartX + totalsLabelWidth + 5, y + 5, { width: totalsValueWidth, align: 'right' });
        y += totalsRowHeight;
    }

    y += 15;

    // ========== PAYMENT HISTORY ==========
    const payments = inv.payments as any[] || [];
    if (payments.length > 0) {
        doc.rect(MARGIN, y, CONTENT_WIDTH, 22).fill(COLORS.headerBg);
        doc.strokeColor(COLORS.border).rect(MARGIN, y, CONTENT_WIDTH, 22).stroke();
        doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10);
        doc.text('Payment History', MARGIN + 10, y + 6);
        y += 22;

        const payColDate = MARGIN + 10;
        const payColAmount = MARGIN + 150;
        const payColNotes = MARGIN + 280;

        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.textLight);
        doc.text('Date', payColDate, y + 6);
        doc.text('Amount', payColAmount, y + 6);
        doc.text('Notes', payColNotes, y + 6);
        y += 20;

        doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
        payments.forEach(p => {
            doc.text(formatDate(p.receivedAt || p.createdAt), payColDate, y);
            doc.text(money(p.amount), payColAmount, y);
            doc.text(p.reference || '-', payColNotes, y);
            y += 16;
        });

        y += 10;
    }

    // ========== NOTES ==========
    const notes = (inv as any).notes;
    if (notes && notes.trim()) {
        if (y > PAGE_HEIGHT - 150) {
            doc.addPage();
            y = MARGIN;
        }

        doc.rect(MARGIN, y, CONTENT_WIDTH, 22).fill('#dbeafe');
        doc.strokeColor(COLORS.border).rect(MARGIN, y, CONTENT_WIDTH, 22).stroke();
        doc.fillColor('#1e40af').font('Helvetica-Bold').fontSize(10);
        doc.text('Notes / Comments', MARGIN + 10, y + 6);
        y += 22;

        doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
        doc.text(notes.trim(), MARGIN + 10, y + 5, { width: CONTENT_WIDTH - 20, lineGap: 3 });
        y += Math.ceil(notes.length / 80) * 14 + 20;
    }

    // ========== TERMS AND CONDITIONS ==========
    if (y > PAGE_HEIGHT - 200) {
        doc.addPage();
        y = MARGIN;
    }

    doc.rect(MARGIN, y, CONTENT_WIDTH, 22).fill(COLORS.headerBg);
    doc.strokeColor(COLORS.border).rect(MARGIN, y, CONTENT_WIDTH, 22).stroke();
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10);
    doc.text('Terms And Conditions', MARGIN + 10, y + 6);
    y += 30;

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    const terms = [
        '1. Goods once sold will not be taken back or exchanged.',
        '2. We are not responsible for damage, shortage or breakage after dispatch.',
        '3. All disputes are subject to Ahmedabad jurisdiction.',
        '4. E. & O.E. (Errors and Omissions Excepted).'
    ];

    if (balance <= 0) {
        terms.unshift('Payment completed in full.');
    }

    terms.forEach(term => {
        doc.text(term, MARGIN + 10, y, { width: CONTENT_WIDTH - 20 });
        y += 12;
    });

    y += 30;

    // ========== AUTHORIZED SIGNATORY ==========
    if (y > PAGE_HEIGHT - 100) {
        doc.addPage();
        y = MARGIN;
    }

    const sigX = PAGE_WIDTH - MARGIN - 180;
    const sigWidth = 180;

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    doc.text('For UDAY DAIRY EQUIPMENTS', sigX, y, { width: sigWidth, align: 'center' });
    y += 12;

    const signatureData = (inv as any).signature;
    const sigImgWidth = 100;
    const sigImgX = sigX + (sigWidth - sigImgWidth) / 2;

    if (signatureData && signatureData.startsWith('data:image')) {
        try {
            const base64Data = signatureData.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imageBuffer, sigImgX, y, {
                fit: [sigImgWidth, 50],
                align: 'center',
                valign: 'center'
            });
            y += 55;
        } catch (err) {
            y += 50;
        }
    } else {
        y += 50;
    }

    const lineWidth = 140;
    const lineX = sigX + (sigWidth - lineWidth) / 2;
    doc.strokeColor(COLORS.text).lineWidth(0.5);
    doc.moveTo(lineX, y).lineTo(lineX + lineWidth, y).stroke();
    y += 8;

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text('Authorized Signatory', sigX, y, { width: sigWidth, align: 'center' });

    doc.end();
}

// ========== PROFORMA INVOICE PDF ==========
export async function generateProformaPdfContent(proforma: any, res: Response) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${proforma.proformaNo}.pdf"`);

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true } as any);
    doc.pipe(res as any);

    const SAFE_BOTTOM = PAGE_HEIGHT - 60;

    const PROFORMA_COLORS = {
        primary: '#1a202c',
        accent: '#3182ce',
        text: '#2d3748',
        textLight: '#4a5568',
        textMuted: '#718096',
        border: '#e2e8f0',
        headerBg: '#f7fafc',
        success: '#38a169',
    };

    const FONTS = {
        title: { font: 'Helvetica-Bold', size: 24 },
        heading: { font: 'Helvetica-Bold', size: 12 },
        subheading: { font: 'Helvetica-Bold', size: 10 },
        body: { font: 'Helvetica', size: 9 },
        small: { font: 'Helvetica', size: 8 },
        tableHeader: { font: 'Helvetica-Bold', size: 8 },
        tableBody: { font: 'Helvetica', size: 8 },
    };

    const formatDateProforma = (d: Date | string | null | undefined) =>
        d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

    const setFont = (type: keyof typeof FONTS, color = PROFORMA_COLORS.text) => {
        const { font, size } = FONTS[type];
        doc.font(font).fontSize(size).fillColor(color);
    };

    let y = 40;

    const checkPageBreak = (requiredSpace: number) => {
        if (y + requiredSpace > SAFE_BOTTOM) {
            doc.addPage();
            y = 40;
        }
    };

    // Calculate totals
    const itemsSubtotal = (proforma.items as any[]).reduce((sum, it) => {
        const qty = Number(it.qty || 0);
        const price = Number(it.price || 0);
        return sum + qty * price;
    }, 0);

    const itemsGstAmount = (proforma.items as any[]).reduce((sum, it) => {
        const qty = Number(it.qty || 0);
        const price = Number(it.price || 0);
        const gstPct = Number(it.gst || 0);
        const lineSubtotal = qty * price;
        return sum + (lineSubtotal * gstPct) / 100;
    }, 0);

    const extraCharges = Array.isArray(proforma.extraCharges) ? proforma.extraCharges as any[] : [];
    const extraChargesTotal = extraCharges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const estimatedTotal = itemsSubtotal + itemsGstAmount + extraChargesTotal;

    // === HEADER SECTION ===
    try {
        const logoPath = path.join(process.cwd(), 'public', 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 40, y, { width: 50, height: 50 });
        }
    } catch {
        // Ignore logo errors
    }

    const companyX = 40 + 60;
    setFont('heading', PROFORMA_COLORS.primary);
    doc.text('UDAY DAIRY EQUIPMENTS', companyX, y + 2);

    setFont('small', PROFORMA_COLORS.textMuted);
    doc.text('GSTIN: 24AADFU1188L1ZX', companyX, y + 16);
    doc.text('48/B, Vijay Plaza Complex, Kankariya Road, Near Parsi Agyan', companyX, y + 28);
    doc.text('Ahmedabad - 380022 | Ph: 9974396581 | udaydairyequipments@gmail.com', companyX, y + 40);

    // Document title
    setFont('title', PROFORMA_COLORS.accent);
    doc.text('PROFORMA INVOICE', PAGE_WIDTH - 40 - 180, y, { width: 180, align: 'right' });

    setFont('small', PROFORMA_COLORS.textMuted);
    doc.text('(Not a Tax Invoice)', PAGE_WIDTH - 40 - 180, y + 28, { width: 180, align: 'right' });

    y += 65;

    // Separator line
    doc.strokeColor(PROFORMA_COLORS.border).lineWidth(1.5)
        .moveTo(40, y).lineTo(PAGE_WIDTH - 40, y).stroke();
    y += 20;

    // === BILL TO & INVOICE META SECTION ===
    const buyer = proforma.buyer as any;
    const leftColWidth = 300;
    const rightColXPro = 40 + leftColWidth + 20;
    const rightColWidthPro = CONTENT_WIDTH - leftColWidth - 20;

    // Bill To section
    setFont('subheading', PROFORMA_COLORS.text);
    doc.text('BILL TO:', 40, y);
    y += 15;

    setFont('heading', PROFORMA_COLORS.primary);
    doc.text(buyer?.name || 'Customer', 40, y, { width: leftColWidth });
    y += 15;

    setFont('body', PROFORMA_COLORS.textLight);
    const addrParts = [
        buyer?.addressLine1,
        buyer?.addressLine2,
        buyer?.city,
        buyer?.state,
        buyer?.postalCode,
    ].filter(Boolean);

    if (addrParts.length) {
        doc.text(addrParts.join(', '), 40, y, { width: leftColWidth, lineGap: 2 });
        y += Math.ceil(addrParts.join(', ').length / 50) * 12 + 5;
    }

    if (buyer?.phone) {
        doc.text(`Phone: ${buyer.phone}`, 40, y);
        y += 12;
    }

    if (buyer?.gstin) {
        doc.text(`GSTIN: ${buyer.gstin}`, 40, y);
        y += 12;
    }

    // Invoice meta (right column)
    const metaStartY = y - 70;
    let metaY = metaStartY;

    // Meta box background
    doc.rect(rightColXPro, metaY - 5, rightColWidthPro, 80)
        .fillColor(PROFORMA_COLORS.headerBg).fill()
        .strokeColor(PROFORMA_COLORS.border).stroke();

    metaY += 5;
    setFont('body', PROFORMA_COLORS.text);
    doc.text('Proforma No:', rightColXPro + 10, metaY);
    setFont('subheading', PROFORMA_COLORS.primary);
    doc.text(proforma.proformaNo, rightColXPro + 90, metaY, { width: rightColWidthPro - 100, align: 'right' });

    metaY += 15;
    setFont('body', PROFORMA_COLORS.text);
    doc.text('Proforma Date:', rightColXPro + 10, metaY);
    setFont('subheading', PROFORMA_COLORS.primary);
    doc.text(formatDateProforma(proforma.proformaDate), rightColXPro + 90, metaY, { width: rightColWidthPro - 100, align: 'right' });

    metaY += 15;
    setFont('body', PROFORMA_COLORS.text);
    doc.text('Valid Till:', rightColXPro + 10, metaY);
    setFont('subheading', PROFORMA_COLORS.primary);
    doc.text(formatDateProforma(proforma.validTill), rightColXPro + 90, metaY, { width: rightColWidthPro - 100, align: 'right' });

    metaY += 15;
    setFont('body', PROFORMA_COLORS.text);
    doc.text('Status:', rightColXPro + 10, metaY);
    setFont('subheading', PROFORMA_COLORS.success);
    doc.text(proforma.status || 'Draft', rightColXPro + 90, metaY, { width: rightColWidthPro - 100, align: 'right' });

    y = Math.max(y, metaY + 25);

    // === ITEMS TABLE SECTION ===
    checkPageBreak(100);
    y += 20;

    setFont('subheading', PROFORMA_COLORS.text);
    doc.text('ITEMS DETAILS', 40, y);
    y += 20;

    // Table layout
    const tableX = 35;
    const padding = 4;
    const rowHeight = 24;

    type TextAlign = 'left' | 'right' | 'center' | 'justify';

    const colsProf: Array<{ key: string; width: number; align: TextAlign; label: string }> = [
        { key: 'no', width: 30, align: 'center', label: '#' },
        { key: 'desc', width: 180, align: 'left', label: 'Description' },
        { key: 'hsn', width: 55, align: 'center', label: 'HSN' },
        { key: 'qty', width: 40, align: 'center', label: 'Qty' },
        { key: 'rate', width: 65, align: 'right', label: 'Rate' },
        { key: 'gst', width: 45, align: 'center', label: 'GST%' },
        { key: 'subtotal', width: 70, align: 'right', label: 'Subtotal' },
        { key: 'gstAmt', width: 70, align: 'right', label: 'GST Amt' }
    ];

    const colPositions: number[] = [];
    let currentX = tableX;
    colsProf.forEach((col, index) => {
        colPositions[index] = currentX;
        currentX += col.width;
    });

    const headerY = y;

    // Table header
    colsProf.forEach((col, index) => {
        doc.rect(colPositions[index], headerY, col.width, rowHeight)
            .fillColor(PROFORMA_COLORS.headerBg).fill()
            .strokeColor(PROFORMA_COLORS.border).stroke();
    });

    setFont('tableHeader', PROFORMA_COLORS.text);
    colsProf.forEach((col, index) => {
        const textY = headerY + (rowHeight - 8) / 2;
        doc.text(col.label, colPositions[index] + padding, textY, {
            width: col.width - (padding * 2),
            align: col.align
        });
    });

    y = headerY + rowHeight;

    // Table rows
    setFont('tableBody', PROFORMA_COLORS.text);
    (proforma.items as any[]).forEach((item, idx) => {
        checkPageBreak(rowHeight + 10);

        const qty = Number(item.qty || 0);
        const price = Number(item.price || 0);
        const gstPct = Number(item.gst || 0);
        const lineSubtotal = qty * price;
        const lineGstAmount = (lineSubtotal * gstPct) / 100;

        // Row background and borders
        colsProf.forEach((col, index) => {
            if (idx % 2 === 1) {
                doc.rect(colPositions[index], y, col.width, rowHeight).fillColor('#fafafa').fill();
            }
            doc.rect(colPositions[index], y, col.width, rowHeight)
                .strokeColor(PROFORMA_COLORS.border).stroke();
        });

        const textY = y + (rowHeight - 8) / 2;
        doc.fillColor(PROFORMA_COLORS.text);

        // Serial number
        doc.text(String(idx + 1), colPositions[0] + padding, textY, {
            width: colsProf[0].width - (padding * 2),
            align: 'center' as TextAlign
        });

        // Description
        const itemTitle = item.title || 'Item';
        const fullDesc = item.description ? `${itemTitle} - ${item.description}` : itemTitle;
        doc.text(fullDesc, colPositions[1] + padding, textY, {
            width: colsProf[1].width - (padding * 2),
            height: rowHeight - 4,
            ellipsis: true
        });

        // HSN Code
        doc.text(item.hsnCode || '-', colPositions[2] + padding, textY, {
            width: colsProf[2].width - (padding * 2),
            align: 'center' as TextAlign,
            ellipsis: true
        });

        // Quantity
        doc.text(String(qty), colPositions[3] + padding, textY, {
            width: colsProf[3].width - (padding * 2),
            align: 'center' as TextAlign
        });

        // Rate
        doc.text(money(price), colPositions[4] + padding, textY, {
            width: colsProf[4].width - (padding * 2),
            align: 'right' as TextAlign
        });

        // GST Percentage
        doc.text(`${gstPct.toFixed(1)}%`, colPositions[5] + padding, textY, {
            width: colsProf[5].width - (padding * 2),
            align: 'center' as TextAlign
        });

        // Subtotal
        doc.text(money(lineSubtotal), colPositions[6] + padding, textY, {
            width: colsProf[6].width - (padding * 2),
            align: 'right' as TextAlign
        });

        // GST Amount
        doc.text(money(lineGstAmount), colPositions[7] + padding, textY, {
            width: colsProf[7].width - (padding * 2),
            align: 'right' as TextAlign
        });

        y += rowHeight;
    });

    // === EXTRA CHARGES SECTION ===
    if (extraCharges.length > 0) {
        y += 15;
        checkPageBreak(60);

        setFont('subheading', PROFORMA_COLORS.text);
        doc.text('EXTRA CHARGES', 40, y);
        y += 15;

        extraCharges.forEach((charge, idx) => {
            if (charge.name && charge.amount) {
                setFont('body', PROFORMA_COLORS.textLight);
                doc.text(`${idx + 1}. ${charge.name}`, 40 + 10, y);
                setFont('body', PROFORMA_COLORS.text);
                doc.text(money(Number(charge.amount)), PAGE_WIDTH - 40 - 80, y, { width: 80, align: 'right' as TextAlign });
                y += 12;
            }
        });
    }

    // === TOTALS SECTION ===
    y += 20;
    checkPageBreak(120);

    const summaryX = PAGE_WIDTH - 40 - 250;
    const summaryWidth = 250;
    const summaryY = y;

    // Summary box
    doc.rect(summaryX, summaryY, summaryWidth, 100)
        .strokeColor(PROFORMA_COLORS.border).lineWidth(1.5).stroke();

    let summaryRowY = summaryY + 10;
    const rowSpacing = 15;

    // Items subtotal
    setFont('body', PROFORMA_COLORS.text);
    doc.text('Items Subtotal:', summaryX + 10, summaryRowY);
    setFont('subheading', PROFORMA_COLORS.text);
    doc.text(money(itemsSubtotal), summaryX + 120, summaryRowY, { width: 120, align: 'right' as TextAlign });
    summaryRowY += rowSpacing;

    // GST amount
    setFont('body', PROFORMA_COLORS.text);
    doc.text('GST (approx.):', summaryX + 10, summaryRowY);
    setFont('subheading', PROFORMA_COLORS.text);
    doc.text(money(itemsGstAmount), summaryX + 120, summaryRowY, { width: 120, align: 'right' as TextAlign });
    summaryRowY += rowSpacing;

    // Extra charges total
    if (extraChargesTotal > 0) {
        setFont('body', PROFORMA_COLORS.text);
        doc.text('Extra Charges:', summaryX + 10, summaryRowY);
        setFont('subheading', PROFORMA_COLORS.text);
        doc.text(money(extraChargesTotal), summaryX + 120, summaryRowY, { width: 120, align: 'right' as TextAlign });
        summaryRowY += rowSpacing;
    }

    // Separator line
    doc.strokeColor(PROFORMA_COLORS.primary).lineWidth(1)
        .moveTo(summaryX + 10, summaryRowY + 2)
        .lineTo(summaryX + summaryWidth - 10, summaryRowY + 2).stroke();
    summaryRowY += 8;

    // Grand total
    setFont('heading', PROFORMA_COLORS.primary);
    doc.text('ESTIMATED TOTAL:', summaryX + 10, summaryRowY);
    setFont('title', PROFORMA_COLORS.accent);
    doc.fontSize(14).text(money(estimatedTotal), summaryX + 120, summaryRowY, { width: 120, align: 'right' as TextAlign });

    y = summaryY + 110;

    // === NOTES & TERMS SECTION ===
    if (proforma.notes || proforma.terms) {
        y += 20;
        checkPageBreak(80);

        if (proforma.notes) {
            setFont('subheading', PROFORMA_COLORS.text);
            doc.text('NOTES:', 40, y);
            y += 15;

            setFont('body', PROFORMA_COLORS.textLight);
            doc.text(String(proforma.notes), 40, y, { width: CONTENT_WIDTH, lineGap: 2 });
            y += Math.ceil(String(proforma.notes).length / 80) * 12 + 15;
        }

        if (proforma.terms) {
            checkPageBreak(60);
            setFont('subheading', PROFORMA_COLORS.text);
            doc.text('TERMS & CONDITIONS:', 40, y);
            y += 15;

            setFont('body', PROFORMA_COLORS.textLight);
            doc.text(String(proforma.terms), 40, y, { width: CONTENT_WIDTH, lineGap: 2 });
            y += Math.ceil(String(proforma.terms).length / 80) * 12 + 15;
        }
    }

    // === FOOTER SECTION ===
    checkPageBreak(60);
    y += 20;

    // Disclaimer box
    doc.rect(40, y, CONTENT_WIDTH, 40)
        .fillColor('#fff5f5').fill()
        .strokeColor('#fed7d7').stroke();

    setFont('small', PROFORMA_COLORS.textMuted);
    doc.text(
        'IMPORTANT DISCLAIMER: This is a Proforma Invoice issued for quotation/estimation purposes only. ' +
        'This document does not constitute a tax invoice or represent a completed sale. Final amounts, ' +
        'taxes, and terms are subject to confirmation in the official tax invoice issued at the time of sale.',
        40 + 10,
        y + 8,
        { width: CONTENT_WIDTH - 20, align: 'center', lineGap: 1 }
    );

    y += 50;

    // Signature section
    if (proforma.signature) {
        setFont('body', PROFORMA_COLORS.textLight);
        doc.text('Authorized Signature:', PAGE_WIDTH - 40 - 120, y);
        y += 30;
        doc.strokeColor(PROFORMA_COLORS.border)
            .moveTo(PAGE_WIDTH - 40 - 120, y)
            .lineTo(PAGE_WIDTH - 40, y).stroke();
    }

    doc.end();
}
