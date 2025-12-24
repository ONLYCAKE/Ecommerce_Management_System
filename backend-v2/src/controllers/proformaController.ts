import { Request, Response } from 'express';
import { prisma } from '../prisma';

export async function getAllProformas(req: Request, res: Response) {
  // TODO: implement filtered listing
  const proformas = await prisma.proformaInvoice.findMany({
    include: { buyer: true },
    orderBy: { proformaDate: 'desc' },
  });
  res.json(proformas);
}

export async function getProformaById(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  const proforma = await prisma.proformaInvoice.findUnique({
    where: { id },
    include: { buyer: true, items: { include: { product: true } } },
  });

  if (!proforma) return res.status(404).json({ message: 'Proforma not found' });
  res.json(proforma);
}

export async function createProforma(req: Request, res: Response) {
  // Minimal placeholder implementation; will be extended with proper calculation logic
  const { buyerId, proformaDate, validTill, items = [], notes, terms, extraCharges, signature } = req.body;

  if (!buyerId) {
    return res.status(400).json({ message: 'buyerId is required' });
  }

  const normalizedItems = (items as any[]).map((it) => {
    const qty = Number(it.qty) || 1;
    const price = Number(it.price) || 0;
    const gst = Number(it.gst) || 0;
    const lineSubtotal = qty * price;
    const lineGstAmount = (lineSubtotal * gst) / 100;
    const amount = lineSubtotal + lineGstAmount;

    return {
      productId: it.productId ?? null,
      title: it.title ?? 'Item',
      description: it.description ?? null,
      qty,
      price,
      gst,
      discountPct: Number(it.discountPct) || 0,
      hsnCode: it.hsnCode ?? null,
      amount,
    };
  });

  const total = normalizedItems.reduce((sum, it) => sum + (it.amount || 0), 0);

  // Simple proforma number; will be refined later if needed
  const last = await prisma.proformaInvoice.findFirst({
    orderBy: { id: 'desc' },
  });
  const nextNo = last ? last.id + 1 : 1;
  const proformaNo = `PF-${nextNo.toString().padStart(4, '0')}`;

  const created = await prisma.proformaInvoice.create({
    data: {
      proformaNo,
      buyerId: Number(buyerId),
      proformaDate: proformaDate ? new Date(proformaDate) : undefined,
      validTill: validTill ? new Date(validTill) : undefined,
      status: 'Draft',
      total,
      notes: notes ?? null,
      terms: terms ?? null,
      extraCharges: extraCharges ?? null,
      signature: signature ?? null,
      items: {
        create: normalizedItems,
      },
    },
    include: { buyer: true, items: true },
  });

  res.status(201).json(created);
}

export async function updateProforma(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  const existing = await prisma.proformaInvoice.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Proforma not found' });
  if (existing.status === 'Converted' || existing.status === 'Cancelled') {
    return res.status(400).json({ message: 'Cannot modify a converted or cancelled proforma' });
  }

  const { buyerId, proformaDate, validTill, items = [], notes, terms, extraCharges, signature, status } = req.body;

  const normalizedItems = (items as any[]).map((it) => {
    const qty = Number(it.qty) || 1;
    const price = Number(it.price) || 0;
    const gst = Number(it.gst) || 0;
    const lineSubtotal = qty * price;
    const lineGstAmount = (lineSubtotal * gst) / 100;
    const amount = lineSubtotal + lineGstAmount;

    return {
      productId: it.productId ?? null,
      title: it.title ?? 'Item',
      description: it.description ?? null,
      qty,
      price,
      gst,
      discountPct: Number(it.discountPct) || 0,
      hsnCode: it.hsnCode ?? null,
      amount,
    };
  });

  const total = normalizedItems.reduce((sum, it) => sum + (it.amount || 0), 0);

  const updated = await prisma.proformaInvoice.update({
    where: { id },
    data: {
      buyerId: buyerId ? Number(buyerId) : existing.buyerId,
      proformaDate: proformaDate ? new Date(proformaDate) : existing.proformaDate,
      validTill: validTill ? new Date(validTill) : existing.validTill,
      status: status ?? existing.status,
      total,
      notes: notes ?? existing.notes,
      terms: terms ?? existing.terms,
      extraCharges: extraCharges ?? existing.extraCharges,
      signature: signature ?? existing.signature,
      items: {
        deleteMany: {},
        create: normalizedItems,
      },
    },
    include: { buyer: true, items: true },
  });

  res.json(updated);
}

export async function deleteProforma(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  const existing = await prisma.proformaInvoice.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Proforma not found' });
  if (existing.status !== 'Draft') {
    return res.status(400).json({ message: 'Only draft proformas can be deleted' });
  }

  await prisma.proformaItem.deleteMany({ where: { proformaId: id } });
  await prisma.proformaInvoice.delete({ where: { id } });

  res.status(204).send();
}

export async function generateProformaPdf(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  const proforma = await prisma.proformaInvoice.findUnique({
    where: { id },
    include: { buyer: true, items: true },
  });

  if (!proforma) return res.status(404).json({ message: 'Proforma not found' });

  // Set PDF headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${proforma.proformaNo}.pdf"`);

  // Lazy-load heavy deps
  const PDFDocument = (await import('pdfkit')).default;
  const fs = await import('fs');
  const path = await import('path');

  // A4 page with safe margins for printing
  const doc = new PDFDocument({ 
    size: 'A4', 
    margin: 40,
    bufferPages: true
  } as any);
  doc.pipe(res as any);

  // A4 dimensions and layout constants
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
  const SAFE_BOTTOM = PAGE_HEIGHT - 60; // Safe zone for page breaks

  // Professional color scheme
  const COLORS = {
    primary: '#1a202c',
    accent: '#3182ce',
    text: '#2d3748',
    textLight: '#4a5568',
    textMuted: '#718096',
    border: '#e2e8f0',
    headerBg: '#f7fafc',
    success: '#38a169',
  };

  // Typography hierarchy
  const FONTS = {
    title: { font: 'Helvetica-Bold', size: 24 },
    heading: { font: 'Helvetica-Bold', size: 12 },
    subheading: { font: 'Helvetica-Bold', size: 10 },
    body: { font: 'Helvetica', size: 9 },
    small: { font: 'Helvetica', size: 8 },
    tableHeader: { font: 'Helvetica-Bold', size: 8 },
    tableBody: { font: 'Helvetica', size: 8 },
  };

  // Utility functions
  const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

  const setFont = (type: keyof typeof FONTS, color = COLORS.text) => {
    const { font, size } = FONTS[type];
    doc.font(font).fontSize(size).fillColor(color);
  };

  const checkPageBreak = (requiredSpace: number) => {
    if (y + requiredSpace > SAFE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Calculate totals dynamically from items
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

  let y = MARGIN;

  // === HEADER SECTION ===
  // Company logo and details
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.jpg');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, MARGIN, y, { width: 50, height: 50 });
    }
  } catch {
    // Ignore logo errors
  }

  const companyX = MARGIN + 60;
  setFont('heading', COLORS.primary);
  doc.text('UDAY DAIRY EQUIPMENTS', companyX, y + 2);
  
  setFont('small', COLORS.textMuted);
  doc.text('GSTIN: 24AADFU1188L1ZX', companyX, y + 16);
  doc.text('48/B, Vijay Plaza Complex, Kankariya Road, Near Parsi Agyan', companyX, y + 28);
  doc.text('Ahmedabad - 380022 | Ph: 9974396581 | udaydairyequipments@gmail.com', companyX, y + 40);

  // Document title and disclaimer
  setFont('title', COLORS.accent);
  doc.text('PROFORMA INVOICE', PAGE_WIDTH - MARGIN - 180, y, { width: 180, align: 'right' });
  
  setFont('small', COLORS.textMuted);
  doc.text('(Not a Tax Invoice)', PAGE_WIDTH - MARGIN - 180, y + 28, { width: 180, align: 'right' });

  y += 65;

  // Separator line
  doc.strokeColor(COLORS.border).lineWidth(1.5)
     .moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
  y += 20;

  // === BILL TO & INVOICE META SECTION ===
  const buyer = proforma.buyer as any;
  const leftColWidth = 300;
  const rightColX = MARGIN + leftColWidth + 20;
  const rightColWidth = CONTENT_WIDTH - leftColWidth - 20;

  // Bill To section
  setFont('subheading', COLORS.text);
  doc.text('BILL TO:', MARGIN, y);
  y += 15;

  setFont('heading', COLORS.primary);
  doc.text(buyer?.name || 'Customer', MARGIN, y, { width: leftColWidth });
  y += 15;

  setFont('body', COLORS.textLight);
  const addrParts = [
    buyer?.addressLine1,
    buyer?.addressLine2,
    buyer?.city,
    buyer?.state,
    buyer?.postalCode,
  ].filter(Boolean);
  
  if (addrParts.length) {
    doc.text(addrParts.join(', '), MARGIN, y, { width: leftColWidth, lineGap: 2 });
    y += Math.ceil(addrParts.join(', ').length / 50) * 12 + 5;
  }
  
  if (buyer?.phone) {
    doc.text(`Phone: ${buyer.phone}`, MARGIN, y);
    y += 12;
  }
  
  if (buyer?.gstin) {
    doc.text(`GSTIN: ${buyer.gstin}`, MARGIN, y);
    y += 12;
  }

  // Invoice meta (right column)
  const metaStartY = y - 70;
  let metaY = metaStartY;

  // Meta box background
  doc.rect(rightColX, metaY - 5, rightColWidth, 80)
     .fillColor(COLORS.headerBg).fill()
     .strokeColor(COLORS.border).stroke();

  metaY += 5;
  setFont('body', COLORS.text);
  doc.text('Proforma No:', rightColX + 10, metaY);
  setFont('subheading', COLORS.primary);
  doc.text(proforma.proformaNo, rightColX + 90, metaY, { width: rightColWidth - 100, align: 'right' as TextAlign });

  metaY += 15;
  setFont('body', COLORS.text);
  doc.text('Proforma Date:', rightColX + 10, metaY);
  setFont('subheading', COLORS.primary);
  doc.text(formatDate(proforma.proformaDate), rightColX + 90, metaY, { width: rightColWidth - 100, align: 'right' as TextAlign });

  metaY += 15;
  setFont('body', COLORS.text);
  doc.text('Valid Till:', rightColX + 10, metaY);
  setFont('subheading', COLORS.primary);
  doc.text(formatDate(proforma.validTill), rightColX + 90, metaY, { width: rightColWidth - 100, align: 'right' as TextAlign });

  metaY += 15;
  setFont('body', COLORS.text);
  doc.text('Status:', rightColX + 10, metaY);
  setFont('subheading', COLORS.success);
  doc.text(proforma.status || 'Draft', rightColX + 90, metaY, { width: rightColWidth - 100, align: 'right' as TextAlign });

  y = Math.max(y, metaY + 25);

  // === ITEMS TABLE SECTION ===
  checkPageBreak(100);
  y += 20;

  setFont('subheading', COLORS.text);
  doc.text('ITEMS DETAILS', MARGIN, y);
  y += 20;

  // Optimized table layout for A4 (515px content width)
  const tableX = MARGIN - 5; // Shift table slightly left for better alignment
  const tableWidth = CONTENT_WIDTH;
  const padding = 4;
  const rowHeight = 24;
  
  // Column definitions - perfectly fitted to A4 width
  type TextAlign = 'left' | 'right' | 'center' | 'justify';
  
  const cols: Array<{ key: string; width: number; align: TextAlign; label: string }> = [
    { key: 'no', width: 30, align: 'center', label: '#' },
    { key: 'desc', width: 180, align: 'left', label: 'Description' },
    { key: 'hsn', width: 55, align: 'center', label: 'HSN' },
    { key: 'qty', width: 40, align: 'center', label: 'Qty' },
    { key: 'rate', width: 65, align: 'right', label: 'Rate' },
    { key: 'gst', width: 45, align: 'center', label: 'GST%' },
    { key: 'subtotal', width: 70, align: 'right', label: 'Subtotal' },
    { key: 'gstAmt', width: 70, align: 'right', label: 'GST Amt' }
  ];

  // Calculate column positions at runtime
  const colPositions: number[] = [];
  let currentX = tableX;
  cols.forEach((col, index) => {
    colPositions[index] = currentX;
    currentX += col.width;
  });

  const headerY = y;

  // Table header with individual column backgrounds
  cols.forEach((col, index) => {
    doc.rect(colPositions[index], headerY, col.width, rowHeight)
       .fillColor(COLORS.headerBg).fill()
       .strokeColor(COLORS.border).stroke();
  });

  // Header text
  setFont('tableHeader', COLORS.text);
  cols.forEach((col, index) => {
    const textY = headerY + (rowHeight - 8) / 2;
    doc.text(col.label, colPositions[index] + padding, textY, {
      width: col.width - (padding * 2),
      align: col.align
    });
  });

  y = headerY + rowHeight;

  // Table rows
  setFont('tableBody', COLORS.text);
  (proforma.items as any[]).forEach((item, idx) => {
    checkPageBreak(rowHeight + 10);

    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);
    const gstPct = Number(item.gst || 0);
    const lineSubtotal = qty * price;
    const lineGstAmount = (lineSubtotal * gstPct) / 100;

    // Row background and borders
    cols.forEach((col, index) => {
      if (idx % 2 === 1) {
        doc.rect(colPositions[index], y, col.width, rowHeight).fillColor('#fafafa').fill();
      }
      doc.rect(colPositions[index], y, col.width, rowHeight)
         .strokeColor(COLORS.border).stroke();
    });

    // Row data
    const textY = y + (rowHeight - 8) / 2;
    doc.fillColor(COLORS.text);

    // Serial number
    doc.text(String(idx + 1), colPositions[0] + padding, textY, {
      width: cols[0].width - (padding * 2),
      align: 'center' as TextAlign
    });

    // Description (with ellipsis for long text)
    const itemTitle = item.title || 'Item';
    const fullDesc = item.description ? `${itemTitle} - ${item.description}` : itemTitle;
    doc.text(fullDesc, colPositions[1] + padding, textY, {
      width: cols[1].width - (padding * 2),
      height: rowHeight - 4,
      ellipsis: true
    });

    // HSN Code
    doc.text(item.hsnCode || '-', colPositions[2] + padding, textY, {
      width: cols[2].width - (padding * 2),
      align: 'center' as TextAlign,
      ellipsis: true
    });

    // Quantity
    doc.text(String(qty), colPositions[3] + padding, textY, {
      width: cols[3].width - (padding * 2),
      align: 'center' as TextAlign
    });

    // Rate
    doc.text(money(price), colPositions[4] + padding, textY, {
      width: cols[4].width - (padding * 2),
      align: 'right' as TextAlign
    });

    // GST Percentage
    doc.text(`${gstPct.toFixed(1)}%`, colPositions[5] + padding, textY, {
      width: cols[5].width - (padding * 2),
      align: 'center' as TextAlign
    });

    // Subtotal
    doc.text(money(lineSubtotal), colPositions[6] + padding, textY, {
      width: cols[6].width - (padding * 2),
      align: 'right' as TextAlign
    });

    // GST Amount
    doc.text(money(lineGstAmount), colPositions[7] + padding, textY, {
      width: cols[7].width - (padding * 2),
      align: 'right' as TextAlign
    });

    y += rowHeight;
  });

  // === EXTRA CHARGES SECTION ===
  if (extraCharges.length > 0) {
    y += 15;
    checkPageBreak(60);
    
    setFont('subheading', COLORS.text);
    doc.text('EXTRA CHARGES', MARGIN, y);
    y += 15;

    extraCharges.forEach((charge, idx) => {
      if (charge.name && charge.amount) {
        setFont('body', COLORS.textLight);
        doc.text(`${idx + 1}. ${charge.name}`, MARGIN + 10, y);
        setFont('body', COLORS.text);
        doc.text(money(Number(charge.amount)), PAGE_WIDTH - MARGIN - 80, y, { width: 80, align: 'right' as TextAlign });
        y += 12;
      }
    });
  }

  // === TOTALS SECTION ===
  y += 20;
  checkPageBreak(120);

  const summaryX = PAGE_WIDTH - MARGIN - 250;
  const summaryWidth = 250;
  const summaryY = y;

  // Summary box
  doc.rect(summaryX, summaryY, summaryWidth, 100)
     .strokeColor(COLORS.border).lineWidth(1.5).stroke();

  let summaryRowY = summaryY + 10;
  const rowSpacing = 15;

  // Items subtotal
  setFont('body', COLORS.text);
  doc.text('Items Subtotal:', summaryX + 10, summaryRowY);
  setFont('subheading', COLORS.text);
  doc.text(money(itemsSubtotal), summaryX + 120, summaryRowY, { width: 120, align: 'right' as TextAlign });
  summaryRowY += rowSpacing;

  // GST amount
  setFont('body', COLORS.text);
  doc.text('GST (approx.):', summaryX + 10, summaryRowY);
  setFont('subheading', COLORS.text);
  doc.text(money(itemsGstAmount), summaryX + 120, summaryRowY, { width: 120, align: 'right' as TextAlign });
  summaryRowY += rowSpacing;

  // Extra charges total
  if (extraChargesTotal > 0) {
    setFont('body', COLORS.text);
    doc.text('Extra Charges:', summaryX + 10, summaryRowY);
    setFont('subheading', COLORS.text);
    doc.text(money(extraChargesTotal), summaryX + 120, summaryRowY, { width: 120, align: 'right' as TextAlign });
    summaryRowY += rowSpacing;
  }

  // Separator line
  doc.strokeColor(COLORS.primary).lineWidth(1)
     .moveTo(summaryX + 10, summaryRowY + 2)
     .lineTo(summaryX + summaryWidth - 10, summaryRowY + 2).stroke();
  summaryRowY += 8;

  // Grand total
  setFont('heading', COLORS.primary);
  doc.text('ESTIMATED TOTAL:', summaryX + 10, summaryRowY);
  setFont('title', COLORS.accent);
  doc.fontSize(14).text(money(estimatedTotal), summaryX + 120, summaryRowY, { width: 120, align: 'right' as TextAlign });

  y = summaryY + 110;

  // === NOTES & TERMS SECTION ===
  if (proforma.notes || proforma.terms) {
    y += 20;
    checkPageBreak(80);

    if (proforma.notes) {
      setFont('subheading', COLORS.text);
      doc.text('NOTES:', MARGIN, y);
      y += 15;
      
      setFont('body', COLORS.textLight);
      doc.text(String(proforma.notes), MARGIN, y, { 
        width: CONTENT_WIDTH, 
        lineGap: 2 
      });
      y += Math.ceil(String(proforma.notes).length / 80) * 12 + 15;
    }

    if (proforma.terms) {
      checkPageBreak(60);
      setFont('subheading', COLORS.text);
      doc.text('TERMS & CONDITIONS:', MARGIN, y);
      y += 15;
      
      setFont('body', COLORS.textLight);
      doc.text(String(proforma.terms), MARGIN, y, { 
        width: CONTENT_WIDTH, 
        lineGap: 2 
      });
      y += Math.ceil(String(proforma.terms).length / 80) * 12 + 15;
    }
  }

  // === FOOTER SECTION ===
  // Ensure footer is on the same page or move to new page
  checkPageBreak(60);
  y += 20;

  // Disclaimer box
  doc.rect(MARGIN, y, CONTENT_WIDTH, 40)
     .fillColor('#fff5f5').fill()
     .strokeColor('#fed7d7').stroke();

  setFont('small', COLORS.textMuted);
  doc.text(
    'IMPORTANT DISCLAIMER: This is a Proforma Invoice issued for quotation/estimation purposes only. ' +
    'This document does not constitute a tax invoice or represent a completed sale. Final amounts, ' +
    'taxes, and terms are subject to confirmation in the official tax invoice issued at the time of sale.',
    MARGIN + 10,
    y + 8,
    { width: CONTENT_WIDTH - 20, align: 'center', lineGap: 1 }
  );

  y += 50;

  // Signature section
  if (proforma.signature) {
    setFont('body', COLORS.textLight);
    doc.text('Authorized Signature:', PAGE_WIDTH - MARGIN - 120, y);
    y += 30;
    doc.strokeColor(COLORS.border)
       .moveTo(PAGE_WIDTH - MARGIN - 120, y)
       .lineTo(PAGE_WIDTH - MARGIN, y).stroke();
  }

  doc.end();
}

export async function convertProformaToInvoice(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  const proforma = await prisma.proformaInvoice.findUnique({
    where: { id },
    include: { items: true, invoice: true },
  });

  if (!proforma) return res.status(404).json({ message: 'Proforma not found' });
  if (proforma.status === 'Converted') {
    return res.status(400).json({ message: 'Proforma already converted' });
  }

  // Safety guard: if an invoice is already linked via relation, do not create another one
  if (proforma.invoice) {
    return res.status(400).json({ message: 'Invoice already exists for this proforma' });
  }

  // Generate next invoice number using the same pattern as getNextInvoiceNo
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `INV-${y}${m}-`;

  const last = await prisma.invoice.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { invoiceNo: true },
  });

  let nextCounter = 1;
  if (last?.invoiceNo) {
    const seq = last.invoiceNo.split('-')[2] || '0000';
    const n = parseInt(seq, 10);
    if (!Number.isNaN(n)) nextCounter = n + 1;
  }

  const invoiceNo = `${prefix}${String(nextCounter).padStart(4, '0')}`;

  // Create a DRAFT invoice only, with copied line items but **no payments** and **no accounting side-effects**
  const createdInvoice = await prisma.invoice.create({
    data: {
      invoiceNo,
      buyerId: proforma.buyerId,
      // Do not set supplier or payments here; this is a non-accounting draft
      paymentMethod: null,
      status: 'Draft',
      total: 0, // Keep total zero to avoid affecting summaries until user edits/finalizes
      balance: 0,
      serviceCharge: 0,
      signature: proforma.signature ?? null,
      notes: proforma.notes ?? null,
      extraCharges: proforma.extraCharges ?? undefined,
      proformaId: proforma.id,
      items: {
        create: proforma.items.map((it) => ({
          productId: it.productId ?? null,
          title: it.title,
          description: it.description ?? null,
          qty: it.qty,
          price: it.price,
          gst: it.gst,
          discountPct: it.discountPct,
          hsnCode: it.hsnCode ?? null,
          amount: 0, // amount will be recalculated when invoice is actually finalized
        })),
      },
    },
  });

  const updated = await prisma.proformaInvoice.update({
    where: { id },
    data: { status: 'Converted' },
  });

  res.json({
    message: 'Proforma converted to draft invoice successfully',
    proforma: updated,
    invoice: createdInvoice,
  });
}
