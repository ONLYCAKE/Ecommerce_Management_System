import type { Request, Response } from 'express';
import { prisma } from '../prisma.ts';
// Note: We intentionally avoid strict Prisma input typing here to preserve the
// original conditional supplier connect logic from JS, which may omit supplier.
// The schema requires supplier, so we keep runtime behavior and use 'any' for payloads.

/* ----------------------------- GET ALL INVOICES ----------------------------- */
export const getAllInvoices = async (req: Request, res: Response) => {
  try {
    const where = (req.query as any).status ? { status: (req.query as any).status as string } : undefined;
    const items = await prisma.invoice.findMany({
      where,
      include: { buyer: true, supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err: any) {
    console.error('[ERROR] getAllInvoices:', err);
    res.status(500).json({ message: 'Server error while fetching invoices' });
  }
};

/* ---------------------------- GENERATE INVOICE NO --------------------------- */
export const getNextInvoiceNo = async (_req: Request, res: Response) => {
  try {
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

    const next = `${prefix}${String(nextCounter).padStart(4, '0')}`;
    res.json({ invoiceNo: next });
  } catch (e: any) {
    console.error('[ERROR] getNextInvoiceNo:', e);
    res.status(500).json({ message: 'Failed to generate invoice number' });
  }
};

/* ---------------------------- GET INVOICE BY NO ---------------------------- */
export const getInvoiceByNo = async (req: Request, res: Response) => {
  try {
    const { invoiceNo } = req.params as { invoiceNo: string };
    const item = await prisma.invoice.findUnique({
      where: { invoiceNo },
      include: { buyer: true, supplier: true, items: { include: { product: true } } },
    });
    if (!item) return res.status(404).json({ message: 'Invoice not found' });
    res.json(item);
  } catch (err: any) {
    console.error('[ERROR] getInvoiceByNo:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ------------------------------- CREATE INVOICE ----------------------------- */
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const body = req.body as any;
    const { invoiceNo, buyerId, paymentMethod = null, status = 'Processing', items = [], serviceCharge = 0 } = body;

    if (!invoiceNo || !buyerId) {
      return res.status(400).json({ message: 'Invoice number and buyer are required.' });
    }

    const normalized = (items as any[])
      .filter(it => (it.title || it.productId) && Number(it.qty) > 0)
      .map(it => ({
        ...(it.productId ? { productId: Number(it.productId) } : {}),
        title: it.title || it.productTitle || 'Untitled Item',
        description: it.description || null,
        qty: Number(it.qty) || 1,
        price: Number(it.price) || 0,
        gst: Number(it.gst) || 0,
        discountPct: Number(it.discountPct) || 0,
        amount:
          (Number(it.price) || 0) *
          (Number(it.qty) || 1) *
          (1 - (Number(it.discountPct) || 0) / 100) *
          (1 + (Number(it.gst) || 0) / 100),
      }));

    const total = normalized.reduce((s, it) => s + it.amount, 0) + Number(serviceCharge || 0);

    let derivedSupplierId: number | null = null;
    const firstProduct = (items as any[]).find(n => n.productId);
    if (firstProduct) {
      const prod = await prisma.product.findUnique({ where: { id: Number(firstProduct.productId) } });
      derivedSupplierId = (prod?.supplierId as number | undefined) ?? null;
    }

    const createData: any = {
      invoiceNo,
      buyer: { connect: { id: Number(buyerId) } },
      supplier: derivedSupplierId ? { connect: { id: derivedSupplierId } } : undefined,
      paymentMethod: paymentMethod as any,
      status: status as any,
      total,
      balance: total,
      signature: body.signature || null,
      items: { create: normalized as any },
    };

    const created = await prisma.invoice.create({
      data: createData,
      include: { buyer: true, supplier: true, items: { include: { product: true } } },
    });

    (req.app as any).get('io')?.emit('invoice.created', created);
    res.status(201).json(created);
  } catch (err: any) {
    console.error('[ERROR] createInvoice:', err);
    res.status(500).json({ message: 'Failed to create invoice', error: err.message });
  }
};

/* ------------------------------- UPDATE INVOICE ----------------------------- */
export const updateInvoice = async (req: Request, res: Response) => {
  const { invoiceNo } = req.params as { invoiceNo: string };
  const { buyerId, supplierId, paymentMethod, status, items, serviceCharge } = req.body as any;
  try {
    const existing = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (!existing) return res.status(404).json({ message: 'Invoice not found' });
    if (existing.status === 'Completed')
      return res.status(400).json({ message: 'Cannot edit a completed invoice' });

    let totalPatch: any = {};

    if (Array.isArray(items)) {
      const normalized = (items as any[])
        .filter(it => (it.title || it.productId) && Number(it.qty) > 0)
        .map(it => ({
          ...(it.productId ? { productId: Number(it.productId) } : {}),
          title: it.title || 'Untitled Item',
          description: it.description || null,
          qty: Number(it.qty) || 1,
          price: Number(it.price) || 0,
          gst: Number(it.gst) || 0,
          discountPct: Number(it.discountPct) || 0,
          amount:
            (Number(it.price) || 0) *
            (Number(it.qty) || 1) *
            (1 - (Number(it.discountPct) || 0) / 100) *
            (1 + (Number(it.gst) || 0) / 100),
        }));

      const total = normalized.reduce((s, it) => s + it.amount, 0) + Number(serviceCharge || 0);

      await prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
      await prisma.invoice.update({
        where: { id: existing.id },
        data: { items: { create: normalized } },
      });

      totalPatch = { total, balance: total };
    }

    const updateData: any = {
      buyer: buyerId ? { connect: { id: Number(buyerId) } } : undefined,
      supplier: supplierId ? { connect: { id: Number(supplierId) } } : undefined,
      paymentMethod: paymentMethod as any,
      status: status as any,
      signature: req.body.signature !== undefined ? req.body.signature : undefined,
      ...(totalPatch as any),
    };

    const updated = await prisma.invoice.update({
      where: { id: existing.id },
      data: updateData,
      include: { buyer: true, supplier: true, items: { include: { product: true } } },
    });

    (req.app as any).get('io')?.emit('invoice.updated', updated);
    res.json(updated);
  } catch (e: any) {
    console.error('[ERROR] updateInvoice:', e);
    res.status(500).json({ message: 'Failed to update invoice', error: e.message });
  }
};

/* ------------------------------- DELETE INVOICE ----------------------------- */
export const deleteInvoice = async (req: Request, res: Response) => {
  const { invoiceNo } = req.params as { invoiceNo: string };
  try {
    const existing = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
    await prisma.invoice.delete({ where: { id: existing.id } });

    (req.app as any).get('io')?.emit('invoice.deleted', { invoiceNo });
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[ERROR] deleteInvoice:', e);
    res.status(500).json({ message: 'Failed to delete invoice' });
  }
};

/* ----------------------------- MARK AS COMPLETE ----------------------------- */
export const markComplete = async (req: Request, res: Response) => {
  const { invoiceNo } = req.params as { invoiceNo: string };
  try {
    const inv = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });

    if (inv.status === 'Completed') {
      return res.status(400).json({ message: 'Invoice already marked complete' });
    }

    const updated = await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: 'Completed' },
      include: { buyer: true, items: true },
    });

    (req.app as any).get('io')?.emit('invoice.completed', updated);
    res.json({ message: 'Invoice marked as completed', invoice: updated });
  } catch (err: any) {
    console.error('[ERROR] markComplete:', err);
    res.status(500).json({ message: 'Failed to mark invoice as complete', error: err.message });
  }
};

/* --------------------------- GENERATE INVOICE PDF --------------------------- */
export const generateInvoicePdf = async (req: Request, res: Response) => {
  const { invoiceNo } = req.params as { invoiceNo: string };

  try {
    const inv = await prisma.invoice.findUnique({
      where: { invoiceNo },
      include: { buyer: true, supplier: true, items: true },
    });

    if (!inv) return res.status(404).json({ message: 'Invoice not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoiceNo}.pdf"`);

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 50 } as any);
    doc.pipe(res as any);

    const money = (n: number) => `₹${Number(n || 0).toFixed(2)}`;
    const pageWidth = 595.28;
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    // Blue header bar with TAX INVOICE
    (doc as any).rect(margin, y, contentWidth, 35).fill('#5B9BD5');
    (doc as any).fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18)
      .text('TAX INVOICE', margin, y + 10, { width: contentWidth, align: 'center' });

    y += 40;

    // ORIGINAL FOR RECIPIENT (top right, blue)
    (doc as any).fillColor('#5B9BD5').fontSize(9).font('Helvetica-Bold')
      .text('ORIGINAL FOR RECIPIENT', margin, y, { width: contentWidth, align: 'right' });

    y += 20;
    (doc as any).fillColor('#000000');

    // Company name and details (LEFT)
    (doc as any).font('Helvetica-Bold').fontSize(12).text('UDAY DAIRY EQUIPMENTS', margin, y);
    y += 14;
    (doc as any).font('Helvetica').fontSize(9).text('GSTIN: 24AADFU1188L1ZX', margin, y);
    y += 12;
    (doc as any).text('Kankriya Road, Ahmedabad', margin, y);
    y += 12;
    (doc as any).text('Ahmedabad, GUJARAT, 380022', margin, y);

    // Invoice meta (RIGHT) - aligned with company details
    const rightX = margin + 280;
    let metaY = margin + 60;
    (doc as any).font('Helvetica-Bold').fontSize(9);
    (doc as any).text('Invoice #:', rightX, metaY);
    (doc as any).font('Helvetica').text(inv.invoiceNo || 'INV-202512-0004', rightX + 70, metaY);

    metaY += 14;
    (doc as any).font('Helvetica-Bold').text('Invoice Date:', rightX, metaY);
    (doc as any).font('Helvetica').text(new Date(inv.createdAt).toLocaleDateString('en-GB').replace(/\//g, '/'), rightX + 70, metaY);

    metaY += 14;
    (doc as any).font('Helvetica-Bold').text('Due Date:', rightX, metaY);
    (doc as any).font('Helvetica').text(new Date(inv.createdAt).toLocaleDateString('en-GB').replace(/\//g, '/'), rightX + 70, metaY);

    y += 30;

    // Customer Details (LEFT)
    (doc as any).font('Helvetica-Bold').fontSize(10).text('Customer Details:', margin, y);
    y += 14;

    const buyer = inv.buyer as any;
    (doc as any).font('Helvetica-Bold').fontSize(9).text(buyer?.name || 'Gayatri dairy', margin, y);
    y += 12;
    (doc as any).font('Helvetica').fontSize(9);

    if (buyer?.phone) {
      (doc as any).text(`Ph: ${buyer.phone}`, margin, y);
      y += 12;
    }
    if (buyer?.email) {
      (doc as any).text(buyer.email, margin, y);
      y += 12;
    }
    // Add customer GSTIN if available
    if (buyer?.gstin) {
      (doc as any).font('Helvetica-Bold').text('GSTIN: ', margin, y, { continued: true });
      (doc as any).font('Helvetica').text(buyer.gstin);
      y += 12;
    }

    // Place of Supply
    y += 6;
    (doc as any).font('Helvetica-Bold').text('Place of Supply:', margin, y);
    y += 12;
    (doc as any).font('Helvetica').text(buyer?.city || '24-GUJARAT', margin, y);

    // Billing Address (RIGHT)
    let billY = margin + 120;
    (doc as any).font('Helvetica-Bold').fontSize(10).text('Billing Address:', rightX, billY);
    billY += 14;
    (doc as any).font('Helvetica').fontSize(9);

    const addressParts = [
      buyer?.addressLine1,
      buyer?.addressLine2,
      buyer?.area,
      buyer?.city,
      `${buyer?.state}, ${buyer?.postalCode}`,
    ].filter(Boolean);

    addressParts.forEach(part => {
      (doc as any).text(part, rightX, billY);
      billY += 12;
    });

    y = Math.max(y, billY) + 20;

    // Items Table
    const tableTop = y;
    const col1 = margin;
    const col2 = margin + 30;
    const col3 = margin + 250;
    const col4 = margin + 330;
    const col5 = margin + 380;
    const col6 = margin + 450;

    // Table header with gray background
    (doc as any).rect(margin, tableTop, contentWidth, 20).fill('#F2F2F2');
    (doc as any).fillColor('#000000').font('Helvetica-Bold').fontSize(9);

    (doc as any).text('#', col1 + 5, tableTop + 6);
    (doc as any).text('Item', col2, tableTop + 6);
    (doc as any).text('Rate / item', col3, tableTop + 6, { width: 70, align: 'right' });
    (doc as any).text('Qty', col4, tableTop + 6, { width: 40, align: 'right' });
    (doc as any).text('Taxable Value', col5, tableTop + 6, { width: 60, align: 'right' });
    (doc as any).text('Tax Amount', col6, tableTop + 6, { width: 45, align: 'right' });

    y = tableTop + 20;

    // Horizontal line after header
    (doc as any).strokeColor('#CCCCCC').lineWidth(0.5).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();

    // Items
    let taxableTotal = 0;
    let taxTotal = 0;

    (doc as any).font('Helvetica').fontSize(9).fillColor('#000000');
    (inv.items as any[]).forEach((item, i) => {
      y += 12;
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const gst = Number(item.gst) || 0;
      const discount = Number(item.discountPct) || 0;

      const lineSubtotal = price * qty;
      const lineDiscount = lineSubtotal * (discount / 100);
      const lineTaxable = lineSubtotal - lineDiscount;
      const lineTax = lineTaxable * (gst / 100);

      taxableTotal += lineTaxable;
      taxTotal += lineTax;

      (doc as any).text((i + 1).toString(), col1 + 5, y);
      (doc as any).text(item.title || 'Sample Product', col2, y, { width: 210 });

      // HSN code below item name
      if (item.hsn || item.description) {
        y += 10;
        (doc as any).fillColor('#666666').fontSize(8)
          .text(`HSN: ${item.hsn || '00000000'}`, col2, y);
        (doc as any).fillColor('#000000').fontSize(9);
        y -= 10;
      }

      (doc as any).text(money(price), col3, y, { width: 70, align: 'right' });
      (doc as any).text(qty.toString(), col4, y, { width: 40, align: 'right' });
      (doc as any).text(money(lineTaxable), col5, y, { width: 60, align: 'right' });
      (doc as any).text(`${money(lineTax)} (${gst}%)`, col6, y, { width: 45, align: 'right' });

      y += (item.hsn || item.description) ? 22 : 14;
      (doc as any).strokeColor('#EEEEEE').lineWidth(0.5).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
    });

    // Totals section
    y += 10;
    const grandTotal = taxableTotal + taxTotal;

    (doc as any).font('Helvetica').fontSize(9);
    (doc as any).text('Taxable Amount:', col5 - 80, y, { width: 80, align: 'right' });
    (doc as any).text(money(taxableTotal), col6, y, { width: 45, align: 'right' });

    y += 16;
    (doc as any).font('Helvetica-Bold').fontSize(10);
    (doc as any).text('Total', col5 - 80, y, { width: 80, align: 'right' });
    (doc as any).text(money(grandTotal), col6, y, { width: 45, align: 'right' });

    y += 4;
    (doc as any).strokeColor('#000000').lineWidth(1).moveTo(col5 - 80, y).lineTo(margin + contentWidth, y).stroke();

    y += 8;
    (doc as any).font('Helvetica').fontSize(8).fillColor('#666666');
    const amountWords = `Total amount (in words): INR ${Math.round(grandTotal).toLocaleString('en-IN')} Rupees Only.`;
    (doc as any).text(amountWords, margin, y, { width: 300 });

    (doc as any).fillColor('#000000').font('Helvetica').fontSize(9);
    (doc as any).text('Amount Payable:', col5 - 80, y, { width: 80, align: 'right' });
    (doc as any).font('Helvetica-Bold').fontSize(10);
    (doc as any).text(money(grandTotal), col6, y, { width: 45, align: 'right' });

    // Terms and Conditions
    y += 30;
    (doc as any).fillColor('#000000').font('Helvetica-Bold').fontSize(10)
      .text('Terms And Conditions', margin, y);
    y += 14;
    (doc as any).font('Helvetica').fontSize(8).fillColor('#333333');
    (doc as any).text('1) Goods once sold will not be taken back or exchange.', margin, y);
    y += 12;
    (doc as any).text('2) We are not responsible for damage, shortage or breakage after despatched from our premises.', margin, y, { width: contentWidth });
    y += 12;
    (doc as any).text('3) We are not responsible for given guarantee or warranty by the principle of electric & electronics items.', margin, y, { width: contentWidth });
    y += 12;
    (doc as any).text('4) Subject to Ahmedabad Jurisdiction. [E&OE]', margin, y);

    // Signature section
    y += 40;
    (doc as any).fillColor('#000000').font('Helvetica').fontSize(9);
    (doc as any).text('For UDAY DAIRY EQUIPMENTS', margin + contentWidth - 150, y, { width: 150, align: 'right' });

    // Add signature image if available
    const signatureData = (inv as any).signature;
    if (signatureData && signatureData.startsWith('data:image')) {
      try {
        // Extract base64 data
        const base64Data = signatureData.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');

        y += 10;
        // Add signature image (max width 120, max height 40)
        (doc as any).image(imageBuffer, margin + contentWidth - 130, y, {
          fit: [120, 40],
          align: 'right'
        });
        y += 45;
      } catch (err) {
        console.error('Error adding signature image:', err);
        y += 50; // Fallback spacing if image fails
      }
    } else {
      y += 50; // Default spacing when no signature
    }

    (doc as any).strokeColor('#000000').lineWidth(0.5)
      .moveTo(margin + contentWidth - 130, y).lineTo(margin + contentWidth, y).stroke();
    y += 6;
    (doc as any).text('Authorized Signatory', margin + contentWidth - 150, y, { width: 150, align: 'right' });

    (doc as any).end();
  } catch (err: any) {
    console.error('[ERROR] generateInvoicePdf:', err);
    res.status(500).json({ message: 'Failed to generate invoice PDF', error: err.message });
  }
};

/* ------------------------------ DOWNLOAD PDF ------------------------------- */
export const downloadInvoicePdf = async (req: Request, res: Response) => {
  const { invoiceNo } = req.params as { invoiceNo: string };
  try {
    const inv = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (!inv) return res.status(404).json({ message: 'Not found' });

    const path = await import('node:path');
    const fs = await import('node:fs');
    const filePath = (path as any).resolve(process.cwd(), 'uploads', 'invoices', `${invoiceNo}.pdf`);

    if ((fs as any).existsSync(filePath)) return (res as any).sendFile(filePath);
    return generateInvoicePdf(req, res);
  } catch (err: any) {
    console.error('[ERROR] downloadInvoicePdf:', err);
    res.status(500).json({ message: 'Failed to download invoice PDF', error: err.message });
  }
};
