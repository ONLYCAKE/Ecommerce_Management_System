import type { Request, Response } from 'express';
import { prisma } from '../prisma';
import {
  sendInvoiceEmail as sendAutoEmail,
  sendCustomInvoiceEmail,
  generatePlaceholderPDF,
} from '../services/emailService';
import { sendReminder, sendBulkReminders, getReminderHistory } from '../services/reminderService';
import { cancelInvoice as cancelInvoiceService } from '../services/cancelService';

/* ----------------------------- GET ALL INVOICES ----------------------------- */
export const getAllInvoices = async (req: Request, res: Response) => {
  try {
    const { status, paymentMethod, sortBy, sortOrder, date } = req.query as any;

    // Build where clause
    const where: any = {};

    // Only filter by database status for "Cancelled"
    if (status === 'Cancelled') {
      where.status = 'Cancelled';
    }

    if (paymentMethod) {
      const methods = paymentMethod.split(',');
      where.paymentMethod = { in: methods };
    }

    // Date filtering - filter by creation date
    if (date) {
      const filterDate = new Date(date);
      const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));

      where.createdAt = {
        gte: startOfDay,
        lte: endOfDay
      };
    }

    // Build orderBy clause
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'invoiceNo') {
      orderBy = { invoiceNo: sortOrder === 'asc' ? 'asc' : 'desc' };
    } else if (sortBy === 'total') {
      orderBy = { total: sortOrder === 'asc' ? 'asc' : 'desc' };
    }

    const items = await prisma.invoice.findMany({
      where,
      include: {
        buyer: true,
        supplier: true,
        items: { include: { product: true } },
        payments: true  // Include payments for received amount calculation
      },
      orderBy,
    });

    // Calculate received amount and balance for each invoice
    const itemsWithPayments = items.map(inv => {
      const receivedAmount = inv.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = inv.total - receivedAmount;
      return {
        ...inv,
        receivedAmount,
        balance
      };
    });

    // Filter by payment-based status (Unpaid, Partial, Paid)
    let filteredItems = itemsWithPayments;

    if (status && status !== 'All' && status !== 'Cancelled') {
      filteredItems = itemsWithPayments.filter(inv => {
        const receivedAmount = inv.receivedAmount || 0;
        const total = inv.total;

        if (status === 'Unpaid') return receivedAmount === 0;
        if (status === 'Partial') return receivedAmount > 0 && receivedAmount < total;
        if (status === 'Paid') return receivedAmount >= total;

        return true;
      });
    }

    res.json(filteredItems);
  } catch (err: any) {
    console.error('[ERROR] getAllInvoices:', err);
    res.status(500).json({ message: 'Server error while fetching invoices' });
  }
};

/* ----------------------------- GET INVOICE SUMMARY ----------------------------- */
export const getInvoiceSummary = async (req: Request, res: Response) => {
  try {
    const { status, paymentMethod } = req.query as any;

    // Build where clause (same as getAllInvoices)
    const where: any = {};

    // Only filter by database status for "Cancelled"
    if (status === 'Cancelled') {
      where.status = 'Cancelled';
    }

    if (paymentMethod) {
      const methods = paymentMethod.split(',');
      where.paymentMethod = { in: methods };
    }

    // Get all invoices matching filters
    const invoices = await prisma.invoice.findMany({
      where,
      include: { payments: true }
    });

    // Calculate receivedAmount for each invoice
    const invoicesWithPayments = invoices.map(inv => ({
      ...inv,
      receivedAmount: inv.payments.reduce((sum, p) => sum + p.amount, 0)
    }));

    // Filter by payment-based status (same logic as getAllInvoices)
    let filteredInvoices = invoicesWithPayments;

    if (status && status !== 'All' && status !== 'Cancelled') {
      filteredInvoices = invoicesWithPayments.filter(inv => {
        const receivedAmount = inv.receivedAmount || 0;
        const total = inv.total;

        if (status === 'Unpaid') return receivedAmount === 0;
        if (status === 'Partial') return receivedAmount > 0 && receivedAmount < total;
        if (status === 'Paid') return receivedAmount >= total;

        return true;
      });
    }

    // Calculate aggregates from filtered invoices
    let totalSales = 0;
    let totalReceived = 0;
    let totalBalance = 0;

    filteredInvoices.forEach(inv => {
      const receivedAmount = inv.receivedAmount;
      totalSales += inv.total;
      totalReceived += receivedAmount;
      totalBalance += (inv.total - receivedAmount);
    });

    res.json({
      totalSales,
      totalReceived,
      totalBalance,
      count: filteredInvoices.length
    });
  } catch (err: any) {
    console.error('[ERROR] getInvoiceSummary:', err);
    res.status(500).json({ message: 'Server error while fetching summary' });
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
    const { invoiceNo, buyerId, paymentMethod = null, status = 'Processing', items = [], serviceCharge = 0, receivedAmount = 0 } = body;

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
        hsnCode: it.hsnCode || null,
        amount:
          (Number(it.price) || 0) *
          (Number(it.qty) || 1) *
          (1 - (Number(it.discountPct) || 0) / 100) *
          (1 + (Number(it.gst) || 0) / 100),
      }));

    const total = normalized.reduce((s, it) => s + it.amount, 0) + Number(serviceCharge || 0);
    const balance = total - (Number(receivedAmount) || 0);

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
      balance,
      signature: body.signature || null,
      items: { create: normalized as any },
    };
    const created = await prisma.invoice.create({
      data: createData,
      include: { buyer: true, supplier: true, items: { include: { product: true } } },
    });

    // Create payment record if receivedAmount > 0
    if (receivedAmount > 0) {
      await prisma.payment.create({
        data: {
          invoiceId: created.id,
          amount: receivedAmount,
          method: paymentMethod || 'Cash',
          reference: `Initial payment for ${invoiceNo}`,
          receivedAt: new Date(),
          createdBy: (req as any).user?.id || 1,
        },
      });

      // Emit payment created event
      (req.app as any).get('io')?.emit('payment.created', {
        invoiceId: created.id,
        invoiceNo: created.invoiceNo,
        amount: receivedAmount,
        method: paymentMethod || 'Cash',
      });
    }

    // Send email if invoice is not Draft (use service alias sendAutoEmail)
    if (created.status !== 'Draft' && created.buyer?.email) {
      try {
        const pdfBuffer = generatePlaceholderPDF(created.invoiceNo);
        await sendAutoEmail({
          to: created.buyer.email,
          pdfBuffer,
          fileName: `${created.invoiceNo}.pdf`,
        });
        console.log(`✅ Invoice email sent to ${created.buyer.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send invoice email (non-blocking):', emailError);
        // Don't fail the invoice creation if email fails
      }
    }

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
    // Allow editing invoices regardless of payment status

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

    // Send email if status changed from Draft to Completed/Finalized (use service alias sendAutoEmail)
    const statusChanged = existing.status === 'Draft' && updated.status !== 'Draft';
    if (statusChanged && updated.buyer?.email) {
      try {
        const pdfBuffer = generatePlaceholderPDF(updated.invoiceNo);
        await sendAutoEmail({
          to: updated.buyer.email,
          pdfBuffer,
          fileName: `${updated.invoiceNo}.pdf`,
        });
        console.log(`✅ Invoice email sent to ${updated.buyer.email} (status changed to ${updated.status})`);
      } catch (emailError) {
        console.error('❌ Failed to send invoice email (non-blocking):', emailError);
      }
    }

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
    const fs = await import('fs');
    const path = await import('path');

    const doc = new PDFDocument({ size: 'A4', margin: 48 } as any);
    doc.pipe(res as any);

    // NOTE: If you want the rupee glyph to always render correctly,
    // place a TTF in public/fonts (e.g. Roboto-Regular.ttf, Roboto-Bold.ttf)
    // and uncomment the registerFont lines below (and ensure path is correct).
    // try {
    //   const fontsDir = path.join(process.cwd(), 'public', 'fonts');
    //   doc.registerFont('Main', path.join(fontsDir, 'Roboto-Regular.ttf'));
    //   doc.registerFont('Main-Bold', path.join(fontsDir, 'Roboto-Bold.ttf'));
    // } catch (e) {
    //   // fallback to built-in fonts
    // }

    // Helpers
    // Use 'Rs' prefix to avoid viewer/font glyph problems for ₹ symbol
    const money = (n: number) => `Rs ${Number(n || 0).toFixed(2)}`;
    const pageWidth = 595.28; // A4 width in points
    const margin = 35; // Reduced margin for more content space
    const contentWidth = pageWidth - margin * 2; // 525.28 points available

    // Optimized column layout to fit within page (all values from left edge)
    const col = {
      idx: margin,                    // # column at 35
      itemX: margin + 25,             // Item at 60
      rateX: margin + 260,            // Rate at 295
      qtyX: margin + 335,             // Qty at 370
      taxableX: margin + 385,         // Taxable at 420
      taxX: margin + 470,             // Tax at 505 (leaves 55pt for tax column, ends at 560, within 595.28)
    };

    // Top Y
    let y = margin;

    // Logo (left) + Blue header bar
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.jpg');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, margin, y, { width: 48, height: 48 });
      }
    } catch (err) {
      // ignore missing logo
    }

    // Blue header rect and title
    const headerX = margin + 60;
    const headerW = contentWidth - 60;
    doc
      .rect(headerX, y, headerW, 50)
      .fill('#5B9BD5');
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('TAX INVOICE', headerX, y + 14, { width: headerW, align: 'center' });

    y += 62;

    // ORIGINAL FOR RECIPIENT (right, small blue)
    doc
      .fillColor('#5B9BD5')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('ORIGINAL FOR RECIPIENT', margin, y, { width: contentWidth, align: 'right' });

    y += 14;

    // Company block (left) - bold name + details
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(13).text('UDAY DAIRY EQUIPMENTS', margin, y);
    y += 16;
    doc.font('Helvetica').fontSize(9).text('GSTIN: 24AADFU1188L1ZX', margin, y);
    y += 12;
    doc.text('Kankriya Road, Ahmedabad', margin, y);
    y += 11;
    doc.text('Ahmedabad, GUJARAT, 380022', margin, y);

    // Invoice meta (right)
    const metaX = margin + contentWidth - 220;
    let metaY = margin + 92;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text('Invoice #:', metaX, metaY);
    doc.font('Helvetica').fontSize(9).text(inv.invoiceNo || invoiceNo, metaX + 70, metaY, { width: 140 });

    metaY += 14;
    doc.font('Helvetica-Bold').text('Invoice Date:', metaX, metaY);
    doc.font('Helvetica').text(new Date(inv.createdAt).toLocaleDateString('en-GB'), metaX + 70, metaY, { width: 140 });

    metaY += 14;
    doc.font('Helvetica-Bold').text('Due Date:', metaX, metaY);
    doc.font('Helvetica').text(new Date(inv.createdAt).toLocaleDateString('en-GB'), metaX + 70, metaY, { width: 140 });

    y = Math.max(y + 40, metaY + 8);

    // Customer block (left)
    doc.font('Helvetica-Bold').fontSize(10).text('Customer Details:', margin, y);
    y += 14;
    const buyer = inv.buyer as any;
    doc.font('Helvetica-Bold').fontSize(10).text(buyer?.name || 'Customer Name', margin, y);
    y += 14;
    doc.font('Helvetica').fontSize(9);
    if (buyer?.phone) { doc.text(`Ph: ${buyer.phone}`, margin, y); y += 12; }
    if (buyer?.email) { doc.text(buyer.email, margin, y); y += 12; }
    if (buyer?.gstin) {
      doc.font('Helvetica-Bold').text('GSTIN: ', margin, y, { continued: true });
      doc.font('Helvetica').text(buyer.gstin);
      y += 12;
    }

    // Place of Supply
    doc.font('Helvetica-Bold').text('Place of Supply:', margin, y + 2);
    doc.font('Helvetica').text(buyer?.city || 'N/A', margin + 110, y + 2);
    // Move Y to account for customer block vertical size
    y += 28;

    // Billing address (right)
    const billX = metaX;
    let billY = margin + 140;
    doc.font('Helvetica-Bold').fontSize(10).text('Billing Address:', billX, billY);
    billY += 14;
    doc.font('Helvetica').fontSize(9);
    const addressParts = [
      buyer?.addressLine1,
      buyer?.addressLine2,
      buyer?.area,
      buyer?.city,
      buyer?.state ? `${buyer.state}${buyer?.postalCode ? ', ' + buyer.postalCode : ''}` : null,
    ].filter(Boolean);
    addressParts.forEach(part => { doc.text(part as string, billX, billY, { width: 200 }); billY += 12; });
    y = Math.max(y, billY) + 10;

    // Items table header
    const tableTop = y;
    const headerHeight = 24;
    doc.rect(margin, tableTop, contentWidth, headerHeight).fill('#E8F0FE');
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9);
    doc.text('#', col.idx + 2, tableTop + 7);
    doc.text('Item Description', col.itemX, tableTop + 7);
    doc.text('Rate', col.rateX, tableTop + 7, { width: 65, align: 'right' });
    doc.text('Qty', col.qtyX, tableTop + 7, { width: 40, align: 'right' });
    doc.text('Taxable', col.taxableX, tableTop + 7, { width: 75, align: 'right' });
    doc.text('Tax', col.taxX, tableTop + 7, { width: 55, align: 'right' });

    y = tableTop + headerHeight + 6;

    // thin divider
    doc.strokeColor('#DDDDDD').lineWidth(0.5).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
    y += 6;

    // Items rows
    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    let taxableTotal = 0;
    let taxTotal = 0;

    (inv.items as any[]).forEach((item, i) => {
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

      // Row top
      doc.text((i + 1).toString(), col.idx + 2, y);
      doc.text(item.title || 'Sample Product', col.itemX, y, { width: col.rateX - col.itemX - 10 });

      // HSN/desc on next line in smaller gray text if present
      if (item.hsnCode || item.description) {
        const desc = `HSN: ${item.hsnCode || '—'}${item.description ? ' — ' + String(item.description).slice(0, 50) : ''}`;
        doc.font('Helvetica').fontSize(8).fillColor('#666666').text(desc, col.itemX, y + 12, { width: col.rateX - col.itemX - 10 });
        doc.font('Helvetica').fontSize(9).fillColor('#000000');
      }

      // Right aligned numeric columns with proper widths
      doc.text(money(price), col.rateX, y, { width: 65, align: 'right' });
      doc.text(String(qty), col.qtyX, y, { width: 40, align: 'right' });
      doc.text(money(lineTaxable), col.taxableX, y, { width: 75, align: 'right' });
      doc.text(`${money(lineTax)}`, col.taxX, y, { width: 55, align: 'right' });

      // Advance y depending on whether description printed
      y += (item.hsnCode || item.description) ? 28 : 18;

      // row divider
      doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
      y += 6;

      // Prevent writing off page: simple page break
      if (y > 750) {
        doc.addPage();
        y = margin;
      }
    });

    // ----------------- START: Totals / Amount in words / Amount Payable -----------------
    y += 6;

    const grandTotal = taxableTotal + taxTotal;

    // positions
    const totalsLabelX = col.taxableX - 110;   // label (right aligned)
    const totalsValueX = col.taxX;             // value (right aligned)

    // Taxable Amount row (above underline)
    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    doc.text('Taxable Amount:', totalsLabelX, y, { width: 100, align: 'right' });
    doc.text(money(taxableTotal), totalsValueX, y, { width: 80, align: 'right' });

    y += 16;

    // Grand Total (bold, above underline)
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total', totalsLabelX, y, { width: 100, align: 'right' });
    doc.text(money(grandTotal), totalsValueX, y, { width: 80, align: 'right' });

    // underline below totals (clear separation)
    const underlineY = y + 12;
    const underlineX1 = margin;
    const underlineX2 = margin + contentWidth;
    doc.strokeColor('#000000').lineWidth(1).moveTo(underlineX1, underlineY).lineTo(underlineX2, underlineY).stroke();

    // Amount in words (left) and Amount Payable (right) placed below underline
    let afterUnderlineY = underlineY + 10;
    doc.font('Helvetica').fontSize(8).fillColor('#666666');
    const amountWords = `Total amount (in words): INR ${Math.round(grandTotal).toLocaleString('en-IN')} Rupees Only.`;
    doc.text(amountWords, margin, afterUnderlineY, { width: Math.max(220, contentWidth - 320) });

    doc.fillColor('#000000').font('Helvetica').fontSize(9);
    doc.text('Amount Payable:', totalsLabelX, afterUnderlineY, { width: 100, align: 'right' });
    doc.font('Helvetica-Bold').text(money(grandTotal), totalsValueX, afterUnderlineY, { width: 80, align: 'right' });

    // small spacer before terms
    y = afterUnderlineY + 36;
    // ----------------- END: Totals / Amount in words / Amount Payable -----------------

    // Terms & conditions
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Terms And Conditions', margin, y);
    y += 14;
    doc.font('Helvetica').fontSize(8).fillColor('#333333');
    const terms = [
      '1) Goods once sold will not be taken back or exchange.',
      '2) We are not responsible for damage, shortage or breakage after despatched from our premises.',
      '3) We are not responsible for given guarantee or warranty by the principle of electric & electronics items.',
      '4) Subject to Ahmedabad Jurisdiction. [E&OE]'
    ];
    terms.forEach((t) => { doc.text(t, margin, y, { width: contentWidth - 30 }); y += 12; });

    // Signature area
    y += 18;
    const sigX = margin + contentWidth - 180;
    doc.font('Helvetica').fontSize(9).fillColor('#000000').text('For UDAY DAIRY EQUIPMENTS', sigX, y, { width: 160, align: 'center' });

    // Signature image if present (data url)
    const signatureData = (inv as any).signature;
    if (signatureData && signatureData.startsWith('data:image')) {
      try {
        const base64Data = signatureData.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');
        doc.image(imageBuffer, sigX + 10, y + 18, { fit: [140, 50], align: 'center' });
        y += 68;
      } catch (err) {
        console.error('Error adding signature image:', err);
        y += 60;
      }
    } else {
      y += 60;
    }

    doc.strokeColor('#000000').lineWidth(0.5).moveTo(sigX + 10, y).lineTo(sigX + 150, y).stroke();
    y += 6;
    doc.font('Helvetica').fontSize(9).text('Authorized Signatory', sigX + 10, y, { width: 140, align: 'center' });

    doc.end();
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

/* ----------------------------- GENERATE PDF BUFFER (for email attachments) ----------------------------- */
async function generateInvoicePDFBuffer(inv: any): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const fs = await import('fs');
  const path = await import('path');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 35 } as any);
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Use same PDF generation logic as generateInvoicePdf
    const money = (n: number) => `Rs ${Number(n || 0).toFixed(2)}`;
    const pageWidth = 595.28;
    const margin = 35;
    const contentWidth = pageWidth - margin * 2;

    const col = {
      idx: margin,
      itemX: margin + 25,
      rateX: margin + 260,
      qtyX: margin + 335,
      taxableX: margin + 385,
      taxX: margin + 470,
    };

    let y = margin;

    // Logo + Blue header
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.jpg');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, margin, y, { width: 48, height: 48 });
      }
    } catch (err) { }

    const headerX = margin + 60;
    const headerW = contentWidth - 60;
    doc.rect(headerX, y, headerW, 50).fill('#5B9BD5');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18)
      .text('TAX INVOICE', headerX, y + 14, { width: headerW, align: 'center' });

    y += 62;

    doc.fillColor('#5B9BD5').fontSize(9).font('Helvetica-Bold')
      .text('ORIGINAL FOR RECIPIENT', margin, y, { width: contentWidth, align: 'right' });
    y += 14;

    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(13).text('UDAY DAIRY EQUIPMENTS', margin, y);
    y += 16;
    doc.font('Helvetica').fontSize(9).text('GSTIN: 24AADFU1188L1ZX', margin, y);
    y += 12;
    doc.text('Kankriya Road, Ahmedabad', margin, y);
    y += 11;
    doc.text('Ahmedabad, GUJARAT, 380022', margin, y);

    const metaX = margin + contentWidth - 220;
    let metaY = margin + 92;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text('Invoice #:', metaX, metaY);
    doc.font('Helvetica').fontSize(9).text(inv.invoiceNo, metaX + 70, metaY, { width: 140 });
    metaY += 14;
    doc.font('Helvetica-Bold').text('Invoice Date:', metaX, metaY);
    doc.font('Helvetica').text(new Date(inv.createdAt).toLocaleDateString('en-GB'), metaX + 70, metaY, { width: 140 });
    metaY += 14;
    doc.font('Helvetica-Bold').text('Due Date:', metaX, metaY);
    doc.font('Helvetica').text(new Date(inv.createdAt).toLocaleDateString('en-GB'), metaX + 70, metaY, { width: 140 });

    y = Math.max(y + 40, metaY + 8);

    const buyer = inv.buyer as any;
    doc.font('Helvetica-Bold').fontSize(10).text('Customer Details:', margin, y);
    y += 14;
    doc.font('Helvetica-Bold').fontSize(10).text(buyer?.name || 'Customer Name', margin, y);
    y += 14;
    doc.font('Helvetica').fontSize(9);
    if (buyer?.phone) { doc.text(`Ph: ${buyer.phone}`, margin, y); y += 12; }
    if (buyer?.email) { doc.text(buyer.email, margin, y); y += 12; }
    if (buyer?.gstin) {
      doc.font('Helvetica-Bold').text('GSTIN: ', margin, y, { continued: true });
      doc.font('Helvetica').text(buyer.gstin);
      y += 12;
    }

    doc.font('Helvetica-Bold').text('Place of Supply:', margin, y + 2);
    doc.font('Helvetica').text(buyer?.city || 'N/A', margin + 110, y + 2);
    y += 28;

    const billX = metaX;
    let billY = margin + 140;
    doc.font('Helvetica-Bold').fontSize(10).text('Billing Address:', billX, billY);
    billY += 14;
    doc.font('Helvetica').fontSize(9);
    const addressParts = [
      buyer?.addressLine1,
      buyer?.addressLine2,
      buyer?.area,
      buyer?.city,
      buyer?.state ? `${buyer.state}${buyer?.postalCode ? ', ' + buyer.postalCode : ''}` : null,
    ].filter(Boolean);
    addressParts.forEach(part => { doc.text(part as string, billX, billY, { width: 200 }); billY += 12; });
    y = Math.max(y, billY) + 10;

    // Items table
    const tableTop = y;
    const headerHeight = 24;
    doc.rect(margin, tableTop, contentWidth, headerHeight).fill('#E8F0FE');
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9);
    doc.text('#', col.idx + 2, tableTop + 7);
    doc.text('Item Description', col.itemX, tableTop + 7);
    doc.text('Rate', col.rateX, tableTop + 7, { width: 65, align: 'right' });
    doc.text('Qty', col.qtyX, tableTop + 7, { width: 40, align: 'right' });
    doc.text('Taxable', col.taxableX, tableTop + 7, { width: 75, align: 'right' });
    doc.text('Tax', col.taxX, tableTop + 7, { width: 55, align: 'right' });

    y = tableTop + headerHeight + 6;
    doc.strokeColor('#DDDDDD').lineWidth(0.5).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
    y += 6;

    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    let taxableTotal = 0;
    let taxTotal = 0;

    (inv.items as any[]).forEach((item, i) => {
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

      doc.text((i + 1).toString(), col.idx + 2, y);
      doc.text(item.title || 'Sample Product', col.itemX, y, { width: col.rateX - col.itemX - 10 });

      if (item.hsnCode || item.description) {
        const desc = `HSN: ${item.hsnCode || '—'}${item.description ? ' — ' + String(item.description).slice(0, 50) : ''}`;
        doc.font('Helvetica').fontSize(8).fillColor('#666666').text(desc, col.itemX, y + 12, { width: col.rateX - col.itemX - 10 });
        doc.font('Helvetica').fontSize(9).fillColor('#000000');
      }

      doc.text(money(price), col.rateX, y, { width: 65, align: 'right' });
      doc.text(String(qty), col.qtyX, y, { width: 40, align: 'right' });
      doc.text(money(lineTaxable), col.taxableX, y, { width: 75, align: 'right' });
      doc.text(`${money(lineTax)}`, col.taxX, y, { width: 55, align: 'right' });

      y += (item.hsnCode || item.description) ? 28 : 18;
      doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
      y += 6;
    });

    y += 6;
    const grandTotal = taxableTotal + taxTotal;
    const totalsLabelX = col.taxableX - 110;
    const totalsValueX = col.taxX;

    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    doc.text('Taxable Amount:', totalsLabelX, y, { width: 100, align: 'right' });
    doc.text(money(taxableTotal), totalsValueX, y, { width: 80, align: 'right' });
    y += 16;

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total', totalsLabelX, y, { width: 100, align: 'right' });
    doc.text(money(grandTotal), totalsValueX, y, { width: 80, align: 'right' });

    const underlineY = y + 12;
    doc.strokeColor('#000000').lineWidth(1).moveTo(margin, underlineY).lineTo(margin + contentWidth, underlineY).stroke();

    let afterUnderlineY = underlineY + 10;
    doc.font('Helvetica').fontSize(8).fillColor('#666666');
    const amountWords = `Total amount (in words): INR ${Math.round(grandTotal).toLocaleString('en-IN')} Rupees Only.`;
    doc.text(amountWords, margin, afterUnderlineY, { width: Math.max(220, contentWidth - 320) });

    doc.fillColor('#000000').font('Helvetica').fontSize(9);
    doc.text('Amount Payable:', totalsLabelX, afterUnderlineY, { width: 100, align: 'right' });
    doc.font('Helvetica-Bold').text(money(grandTotal), totalsValueX, afterUnderlineY, { width: 80, align: 'right' });

    y = afterUnderlineY + 36;

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Terms And Conditions', margin, y);
    y += 14;
    doc.font('Helvetica').fontSize(8).fillColor('#333333');
    const terms = [
      '1) Goods once sold will not be taken back or exchange.',
      '2) We are not responsible for damage, shortage or breakage after despatched from our premises.',
      '3) We are not responsible for given guarantee or warranty by the principle of electric & electronics items.',
      '4) Subject to Ahmedabad Jurisdiction. [E&OE]'
    ];
    terms.forEach((t) => { doc.text(t, margin, y, { width: contentWidth - 30 }); y += 12; });

    y += 18;
    const sigX = margin + contentWidth - 180;
    doc.font('Helvetica').fontSize(9).fillColor('#000000').text('For UDAY DAIRY EQUIPMENTS', sigX, y, { width: 160, align: 'center' });

    const signatureData = (inv as any).signature;
    if (signatureData && signatureData.startsWith('data:image')) {
      try {
        const base64Data = signatureData.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');
        doc.image(imageBuffer, sigX + 10, y + 18, { fit: [140, 50], align: 'center' });
        y += 68;
      } catch (err) {
        y += 60;
      }
    } else {
      y += 60;
    }

    doc.strokeColor('#000000').lineWidth(0.5).moveTo(sigX + 10, y).lineTo(sigX + 150, y).stroke();
    y += 6;
    doc.font('Helvetica').fontSize(9).text('Authorized Signatory', sigX + 10, y, { width: 140, align: 'center' });

    doc.end();
  });
}

/* ----------------------------- SEND INVOICE EMAIL (route handler) ----------------------------- */
export const sendInvoiceEmail = async (req: Request, res: Response) => {
  try {
    const { invoiceNo } = req.params as { invoiceNo: string };
    const { to, subject, htmlBody } = req.body as { to: string; subject: string; htmlBody: string };

    if (!to || !subject || !htmlBody) {
      return res.status(400).json({ message: 'Missing required fields: to, subject, htmlBody' });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNo },
      include: { buyer: true, supplier: true, items: true },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (!invoice.buyer?.email) {
      return res.status(400).json({ message: 'Buyer does not have a valid email address' });
    }

    // Generate proper PDF buffer (same format as View Invoice)
    const pdfBuffer = await generateInvoicePDFBuffer(invoice);

    await sendCustomInvoiceEmail({
      to,
      subject,
      htmlBody,
      pdfBuffer,
      fileName: `${invoice.invoiceNo}.pdf`,
    });

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (err: any) {
    console.error('[ERROR] sendInvoiceEmail:', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  }
};

/* ----------------------------- SEND REMINDER ----------------------------- */
export const sendInvoiceReminder = async (req: Request, res: Response) => {
  try {
    const { invoiceNo } = req.params as { invoiceNo: string };
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const invoice = await prisma.invoice.findUnique({ where: { invoiceNo } });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const result = await sendReminder({ invoiceId: invoice.id, userId });

    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }

    res.json({
      success: true,
      reminder_id: result.reminderId,
      to_email: result.toEmail,
      status: result.status
    });
  } catch (err: any) {
    console.error('[ERROR] sendInvoiceReminder:', err);
    res.status(500).json({ message: 'Failed to send reminder', error: err.message });
  }
};

/* ----------------------------- BULK SEND REMINDERS ----------------------------- */
export const bulkSendReminders = async (req: Request, res: Response) => {
  try {
    const { invoice_ids } = req.body as { invoice_ids: string[] };
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return res.status(400).json({ message: 'invoice_ids array is required' });
    }

    const invoices = await prisma.invoice.findMany({
      where: { invoiceNo: { in: invoice_ids } }
    });

    const invoiceIds = invoices.map(inv => inv.id);

    const results = await sendBulkReminders(invoiceIds, userId);

    res.json(results);
  } catch (err: any) {
    console.error('[ERROR] bulkSendReminders:', err);
    res.status(500).json({ message: 'Failed to send bulk reminders', error: err.message });
  }
};

/* ----------------------------- GET REMINDER HISTORY ----------------------------- */
export const getInvoiceReminders = async (req: Request, res: Response) => {
  try {
    const { invoiceNo } = req.params as { invoiceNo: string };

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNo }
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const reminders = await getReminderHistory(invoice.id);

    res.json({ reminders });
  } catch (err: any) {
    console.error('[ERROR] getInvoiceReminders:', err);
    res.status(500).json({ message: 'Failed to get reminders', error: err.message });
  }
};

/* ----------------------------- CANCEL INVOICE ----------------------------- */
export const cancelInvoice = async (req: Request, res: Response) => {
  try {
    const { invoiceNo } = req.params as { invoiceNo: string };
    const { reason, force } = req.body as { reason: string; force?: boolean };
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ message: 'Cancellation reason is required' });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNo }
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const result = await cancelInvoiceService({
      invoiceId: invoice.id,
      userId,
      reason,
      force: force || false
    });

    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }

    res.json({
      success: true,
      invoice_id: result.invoiceId,
      status: result.status
    });
  } catch (err: any) {
    console.error('[ERROR] cancelInvoice:', err);
    res.status(500).json({ message: 'Failed to cancel invoice', error: err.message });
  }
};
