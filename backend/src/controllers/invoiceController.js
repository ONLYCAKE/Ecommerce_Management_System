import PDFDocument from 'pdfkit';
import { prisma } from '../prisma.js';

/* ----------------------------- GET ALL INVOICES ----------------------------- */
export const getAllInvoices = async (req, res) => {
  try {
    const where = req.query.status ? { status: req.query.status } : undefined;
    const items = await prisma.invoice.findMany({
      where,
      include: { buyer: true, supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err) {
    console.error('[ERROR] getAllInvoices:', err);
    res.status(500).json({ message: 'Server error while fetching invoices' });
  }
};

/* ---------------------------- GENERATE INVOICE NO --------------------------- */
export const getNextInvoiceNo = async (req, res) => {
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
  } catch (e) {
    console.error('[ERROR] getNextInvoiceNo:', e);
    res.status(500).json({ message: 'Failed to generate invoice number' });
  }
};

/* ---------------------------- GET INVOICE BY NO ---------------------------- */
export const getInvoiceByNo = async (req, res) => {
  try {
    const { invoiceNo } = req.params;
    const item = await prisma.invoice.findUnique({
      where: { invoiceNo },
      include: { buyer: true, supplier: true, items: { include: { product: true } } },
    });
    if (!item) return res.status(404).json({ message: 'Invoice not found' });
    res.json(item);
  } catch (err) {
    console.error('[ERROR] getInvoiceByNo:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ------------------------------- CREATE INVOICE ----------------------------- */
export const createInvoice = async (req, res) => {
  try {
    console.log('[DEBUG] Received invoice payload:', req.body);

    const { invoiceNo, buyerId, paymentMethod = null, status = 'Processing', items = [], serviceCharge = 0 } = req.body;

    if (!invoiceNo || !buyerId) {
      return res.status(400).json({ message: 'Invoice number and buyer are required.' });
    }

    // ✅ Correct: use productId, not product connect
    const normalized = items
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

    let derivedSupplierId = null;
    const firstProduct = items.find(n => n.productId);
    if (firstProduct) {
      const prod = await prisma.product.findUnique({ where: { id: Number(firstProduct.productId) } });
      derivedSupplierId = prod?.supplierId || null;
    }

    const created = await prisma.invoice.create({
      data: {
        invoiceNo,
        buyer: { connect: { id: Number(buyerId) } },
        ...(derivedSupplierId ? { supplier: { connect: { id: derivedSupplierId } } } : {}),
        paymentMethod,
        status,
        total,
        balance: total,
        items: { create: normalized },
      },
      include: { buyer: true, supplier: true, items: { include: { product: true } } },
    });

    req.app.get('io')?.emit('invoice.created', created);
    res.status(201).json(created);
  } catch (err) {
    console.error('[ERROR] createInvoice:', err);
    res.status(500).json({ message: 'Failed to create invoice', error: err.message });
  }
};

/* ------------------------------- UPDATE INVOICE ----------------------------- */
export const updateInvoice = async (req, res) => {
  const { invoiceNo } = req.params;
  const { buyerId, supplierId, paymentMethod, status, items, serviceCharge } = req.body;
  try {
    const existing = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (!existing) return res.status(404).json({ message: 'Invoice not found' });
    if (existing.status === 'Completed')
      return res.status(400).json({ message: 'Cannot edit a completed invoice' });

    let totalPatch = {};

    if (Array.isArray(items)) {
      const normalized = items
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

    const updated = await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        ...(buyerId ? { buyer: { connect: { id: Number(buyerId) } } } : {}),
        ...(supplierId ? { supplier: { connect: { id: Number(supplierId) } } } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(status ? { status } : {}),
        ...totalPatch,
      },
      include: { buyer: true, supplier: true, items: { include: { product: true } } },
    });

    req.app.get('io')?.emit('invoice.updated', updated);
    res.json(updated);
  } catch (e) {
    console.error('[ERROR] updateInvoice:', e);
    res.status(500).json({ message: 'Failed to update invoice', error: e.message });
  }
};

/* ------------------------------- DELETE INVOICE ----------------------------- */
export const deleteInvoice = async (req, res) => {
  const { invoiceNo } = req.params;
  try {
    const existing = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
    await prisma.invoice.delete({ where: { id: existing.id } });

    req.app.get('io')?.emit('invoice.deleted', { invoiceNo });
    res.json({ ok: true });
  } catch (e) {
    console.error('[ERROR] deleteInvoice:', e);
    res.status(500).json({ message: 'Failed to delete invoice' });
  }
};

/* ----------------------------- MARK AS COMPLETE ----------------------------- */
export const markComplete = async (req, res) => {
  const { invoiceNo } = req.params;
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

    req.app.get('io')?.emit('invoice.completed', updated);
    res.json({ message: 'Invoice marked as completed', invoice: updated });
  } catch (err) {
    console.error('[ERROR] markComplete:', err);
    res.status(500).json({ message: 'Failed to mark invoice as complete', error: err.message });
  }
};

/* --------------------------- GENERATE INVOICE PDF --------------------------- */
export const generateInvoicePdf = async (req, res) => {
  const { invoiceNo } = req.params;

  try {
    const inv = await prisma.invoice.findUnique({
      where: { invoiceNo },
      include: { buyer: true, supplier: true, items: true },
    });

    if (!inv) return res.status(404).json({ message: 'Invoice not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoiceNo}.pdf"`);

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    doc.pipe(res);

    // Utility functions
    const line = (x1, y1, x2, y2, color = '#E5E5E5') => {
      doc.save().lineWidth(0.8).strokeColor(color).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
    };
    const money = (n) => `₹ ${Number(n || 0).toFixed(2)}`;

    // --- Header ---
    let y = doc.y;
    line(36, y, 559, y, '#cccccc');
    doc.font('Helvetica-Bold').fontSize(18).text('TAX INVOICE', 36, y + 8, { align: 'center' });
    y = doc.y + 8;

    // Company details
    doc.font('Helvetica-Bold').fontSize(10).text('Uday Dairy Equipments', 36, y);
    doc.font('Helvetica').fontSize(9).fillColor('#333')
      .text('48/B Vijay Plaza Complex, Kankariya Road, Ahmedabad - 380022', { width: 330 });
    doc.text('GSTIN: 24AADFU1188L1ZX, State: Gujarat (24)');
    doc.text('Phone: 9974396581 | Email: udaydairyequipments@gmail.com');
    doc.fillColor('#000');

    // Invoice meta (top-right)
    const metaX = 380;
    const dateStr = new Date(inv.createdAt).toLocaleDateString();
    doc.font('Helvetica-Bold').fontSize(10).text('Invoice No:', metaX, y);
    doc.font('Helvetica').text(inv.invoiceNo || '-', metaX + 90, y);
    y = doc.y; doc.font('Helvetica-Bold').text('Date:', metaX, y);
    doc.font('Helvetica').text(dateStr, metaX + 90, y);
    y = doc.y; doc.font('Helvetica-Bold').text('Place of Supply:', metaX, y);
    doc.font('Helvetica').text(inv.buyer?.address?.split(',').slice(-1)[0] || '-', metaX + 90, y);

    // Buyer details
    y = Math.max(doc.y + 10, y + 20);
    doc.font('Helvetica-Bold').text('Bill To', 36, y);
    y = doc.y + 2;
    const billTo = [inv.buyer?.name, inv.buyer?.address].filter(Boolean).join('\n');
    doc.font('Helvetica').fontSize(9).text(billTo || '-', 36, y, { width: 300 });

    // --- Items Table ---
    y = Math.max(y + 36, doc.y + 12);
    const cols = [
      { key: '#', x: 36, w: 20, align: 'left' },
      { key: 'Item Name', x: 60, w: 190, align: 'left' },
      { key: 'HSN/SAC', x: 252, w: 60, align: 'left' },
      { key: 'Qty', x: 314, w: 40, align: 'right' },
      { key: 'Price', x: 358, w: 60, align: 'right' },
      { key: 'GST', x: 422, w: 40, align: 'right' },
      { key: 'Discount', x: 464, w: 55, align: 'right' },
      { key: 'Amount', x: 520, w: 55, align: 'right' },
    ];

    line(36, y, 559, y);
    doc.font('Helvetica-Bold').fontSize(9);
    cols.forEach(c => doc.text(c.key, c.x, y + 4, { width: c.w, align: c.align }));
    line(36, y + 20, 559, y + 20);
    y += 24;
    doc.font('Helvetica').fontSize(9);

    let subTotal = 0;
    inv.items.forEach((it, i) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.price) || 0;
      const gst = Number(it.gst) || 0;
      const discount = Number(it.discountPct) || 0;
      const preTax = price * qty * (1 - discount / 100);
      const gstVal = preTax * (gst / 100);
      const total = preTax + gstVal;
      subTotal += total;

      const row = [
        i + 1,
        it.title || '-',
        it.hsn || '-',
        qty,
        money(price),
        `${gst}%`,
        `${discount}%`,
        money(total)
      ];

      cols.forEach((c, j) => {
        doc.text(row[j].toString(), c.x, y, { width: c.w, align: c.align });
      });
      y += 16;
      line(36, y, 559, y);
    });

    // --- Totals ---
    const tx = 380;
    const tot = (label, val, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(label, tx, y, { width: 100 });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(money(val), tx + 100, y, { width: 79, align: 'right' });
      y = doc.y + 4;
    };

    const serviceCharge = Number(inv.serviceCharge || 0);
    const total = subTotal + serviceCharge;
    const balance = inv.balance ?? total;
    const received = total - balance;

    y += 10;
    tot('Sub Total', subTotal);
    if (serviceCharge) tot('Service Charge', serviceCharge);
    line(tx, y, 559, y, '#000');
    y += 4;
    tot('Total', total, true);
    tot('Received', received);
    tot('Balance', balance);
    tot('Payment Mode', inv.paymentMethod || '-');

    // --- Footer ---
    y += 12;
    doc.font('Helvetica-Bold').text('Amount in Words', 36, y);
    const words = `Rupees ${Math.round(total).toLocaleString('en-IN')} only`;
    y = doc.y + 2;
    doc.font('Helvetica').fontSize(9).text(words);

    y += 8;
    doc.font('Helvetica-Bold').text('Terms & Conditions', 36, y);
    y = doc.y + 2;
    doc.font('Helvetica').fontSize(9)
      .text('1. Goods once sold will not be taken back.', { width: 500 })
      .text('2. Interest @18% p.a. will be charged if the payment is not made within 15 days.', { width: 500 })
      .text('3. All disputes are subject to Ahmedabad jurisdiction.', { width: 500 })
      .text('4. Warranty as per manufacturer terms only.', { width: 500 });

    y = doc.y + 16;
    doc.font('Helvetica-Bold').text('For Uday Dairy Equipments', 380, y, { align: 'right' });
    y += 40;
    line(420, y, 559, y, '#000');
    doc.font('Helvetica').text('Authorized Signatory', 380, y + 6, { align: 'right' });

    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#777')
      .text('Original for Recipient', 36, 806, { align: 'left' });

    doc.end();
  } catch (err) {
    console.error('[ERROR] generateInvoicePdf:', err);
    res.status(500).json({ message: 'Failed to generate invoice PDF', error: err.message });
  }
};

/* ------------------------------ DOWNLOAD PDF ------------------------------- */
export const downloadInvoicePdf = async (req, res) => {
  const { invoiceNo } = req.params;
  try {
    const inv = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (!inv) return res.status(404).json({ message: 'Not found' });

    const path = await import('node:path');
    const fs = await import('node:fs');
    const filePath = path.resolve(process.cwd(), 'uploads', 'invoices', `${invoiceNo}.pdf`);

    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    return generateInvoicePdf(req, res);
  } catch (err) {
    console.error('[ERROR] downloadInvoicePdf:', err);
    res.status(500).json({ message: 'Failed to download invoice PDF', error: err.message });
  }
};
