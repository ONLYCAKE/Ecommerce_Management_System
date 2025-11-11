import PDFDocument from 'pdfkit';
import { prisma } from '../prisma.js';

export const getAllInvoices = async (req, res) => {
  const where = req.query.status ? { status: req.query.status } : undefined;
  const items = await prisma.invoice.findMany({
    where,
    include: { buyer: true, supplier: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(items);
};

export const getNextInvoiceNo = async (req, res) => {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${y}${m}-`;
    // Get latest invoice for this month (by createdAt desc)
    const last = await prisma.invoice.findFirst({
      where: { invoiceNo: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNo: true }
    });
    let nextCounter = 1;
    if (last?.invoiceNo) {
      const parts = last.invoiceNo.split('-');
      const seq = parts[2] || '0000';
      const n = parseInt(seq, 10);
      if (!Number.isNaN(n)) nextCounter = n + 1;
    }
    const next = `${prefix}${String(nextCounter).padStart(4, '0')}`;
    res.json({ invoiceNo: next });
  } catch (e) {
    res.status(500).json({ message: 'Failed to generate invoice number' });
  }
};

export const getInvoiceByNo = async (req, res) => {
  const { invoiceNo } = req.params;
  const item = await prisma.invoice.findUnique({ where: { invoiceNo }, include: { buyer: true, supplier: true, items: { include: { product: true } } } });
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json(item);
};

export const createInvoice = async (req, res) => {
  const { invoiceNo, buyerId, paymentMethod = null, status = 'Processing', items = [], serviceCharge = 0 } = req.body;
  const normalized = items
    .filter(it => (it.title || it.productId) && Number(it.qty) > 0)
    .map(it => ({
      productId: Number(it.productId),
      title: it.title || (it.productTitle || ''),
      description: it.description || null,
      qty: Number(it.qty) || 1,
      price: Number(it.price) || 0,
      gst: Number(it.gst) || 0,
      discountPct: Number(it.discountPct) || 0,
      amount: (Number(it.price)||0) * (Number(it.qty)||1) * (1 - (Number(it.discountPct)||0)/100) * (1 + (Number(it.gst)||0)/100)
    }));
  const total = normalized.reduce((s,it)=> s + it.amount, 0) + (Number(serviceCharge)||0);
  // derive supplierId from first product if present
  let derivedSupplierId = null;
  const firstWithProduct = normalized.find(n => !!n.productId);
  if (firstWithProduct) {
    const prod = await prisma.product.findUnique({ where: { id: firstWithProduct.productId } });
    derivedSupplierId = prod?.supplierId || null;
  }
  const created = await prisma.invoice.create({
    data: {
      invoiceNo,
      buyerId: Number(buyerId),
      supplierId: derivedSupplierId,
      paymentMethod,
      status,
      total,
      balance: total,
      items: { create: normalized }
    },
    include: { items: true }
  });
  try { req.app.get('io')?.emit('invoice.created', created); } catch {}
  res.status(201).json(created);
};

export const updateInvoice = async (req, res) => {
  const { invoiceNo } = req.params;
  const { buyerId, supplierId, paymentMethod, status, items, serviceCharge } = req.body;
  try {
    const existing = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (!existing) return res.status(404).json({ message: 'Not found' });
    if (existing.status === 'Completed') return res.status(400).json({ message: 'Cannot edit a completed invoice' });

    let totalPatch = {};
    if (Array.isArray(items)) {
      const normalized = items
        .filter(it => (it.title || it.productId) && Number(it.qty) > 0)
        .map(it => ({
          productId: Number(it.productId),
          title: it.title || (it.productTitle || ''),
          description: it.description || null,
          qty: Number(it.qty) || 1,
          price: Number(it.price) || 0,
          gst: Number(it.gst) || 0,
          discountPct: Number(it.discountPct) || 0,
          amount: (Number(it.price)||0) * (Number(it.qty)||1) * (1 - (Number(it.discountPct)||0)/100) * (1 + (Number(it.gst)||0)/100)
        }));
      const total = normalized.reduce((s,it)=> s + it.amount, 0) + (serviceCharge !== undefined ? Number(serviceCharge) : 0);
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
      await prisma.invoice.update({ where: { id: existing.id }, data: { items: { create: normalized } } });
      totalPatch = { total, balance: total };
    }
    // if only serviceCharge provided (no items), patch totals based on current items
    if (!Array.isArray(items) && serviceCharge !== undefined) {
      const currentItems = await prisma.invoiceItem.findMany({ where: { invoiceId: existing.id } });
      const itemsTotal = currentItems.reduce((s,it)=> s + it.amount, 0);
      const total = itemsTotal + Number(serviceCharge);
      totalPatch = { ...totalPatch, total, balance: total };
    }

    const updated = await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        ...(buyerId? { buyerId: Number(buyerId) } : {}),
        ...(supplierId? { supplierId: Number(supplierId) } : {}),
        ...(paymentMethod !== undefined? { paymentMethod } : {}),
        ...(status? { status } : {}),
        ...totalPatch,
      },
      include: { items: true }
    });
    try { req.app.get('io')?.emit('invoice.updated', updated); } catch {}
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteInvoice = async (req, res) => {
  const { invoiceNo } = req.params;
  const existing = await prisma.invoice.findUnique({ where: { invoiceNo } });
  if (!existing) return res.status(404).json({ message: 'Not found' });
  await prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
  await prisma.invoice.delete({ where: { id: existing.id } });
  try { req.app.get('io')?.emit('invoice.deleted', { invoiceNo }); } catch {}
  res.json({ ok: true });
};

export const markComplete = async (req, res) => {
  const { invoiceNo } = req.params;
  const inv = await prisma.invoice.findUnique({ where: { invoiceNo } });
  if (!inv) return res.status(404).json({ message: 'Not found' });
  const updated = await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'Completed' } });
  // Generate and save PDF file
  try {
    const full = await prisma.invoice.findUnique({ where: { id: updated.id }, include: { buyer: true, supplier: true, items: true } });
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.resolve(process.cwd(), 'uploads', 'invoices');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${updated.invoiceNo}.pdf`);
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(filePath);
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      doc.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      doc.pipe(out);
      // Reuse the same drawing routine as generateInvoicePdf by inlining minimal call
      // Utilities
      const line = (x1, y1, x2, y2, color = '#E5E5E5') => {
        doc.save().lineWidth(0.8).strokeColor(color).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
      };
      const money = (n) => `₹ ${Number(n || 0).toFixed(2)}`;
      const titleFont = 'Helvetica-Bold';
      const headFont = 'Helvetica-Bold';
      const bodyFont = 'Helvetica';
      let y = doc.y; line(36, y, 559, y, '#cccccc');
      doc.font(titleFont).fontSize(18).text('TAX INVOICE', 36, y + 8, { align: 'center' });
      y = doc.y + 8;
      // Company block
      doc.font(headFont).fontSize(10).text('Uday Dairy Equipments', 36, y);
      doc.font(bodyFont).fontSize(9).fillColor('#333').text('48/B Vijay Plaza Complex, Kankariya Road, Ahmedabad - 380022', { width: 330 });
      doc.text('GSTIN 24AADFU1188L1ZX, State 24 - Gujarat');
      doc.text('Phone 9974396581, Email udaydairyequipments@gmail.com');
      doc.fillColor('#000');
      const metaX = 380;
      const dateStr = new Date(full.createdAt).toLocaleDateString();
      doc.font(headFont).fontSize(10).text('Invoice No:', metaX, y);
      doc.font(bodyFont).text(full.invoiceNo || '-', metaX + 90, y);
      y = doc.y; doc.font(headFont).text('Date:', metaX, y);
      doc.font(bodyFont).text(dateStr, metaX + 90, y);
      y = doc.y; doc.font(headFont).text('Place of Supply:', metaX, y);
      doc.font(bodyFont).text(full.buyer?.address ? (full.buyer.address.split(',').slice(-1)[0] || '-') : '-', metaX + 90, y);
      // Bill To
      y = Math.max(doc.y + 10, y + 20); doc.font(headFont).text('Bill To', 36, y); y = doc.y + 2;
      const billTo = [full.buyer?.name, full.buyer?.address].filter(Boolean).join('\n');
      doc.font(bodyFont).fontSize(9).text(billTo || '-', 36, y, { width: 300 });
      // Table header
      y = Math.max(y + 36, doc.y + 12);
      const cols = [
        { key: '#', x: 36, w: 20, align: 'left' },
        { key: 'Item Name', x: 60, w: 190, align: 'left' },
        { key: 'HSN/SAC', x: 252, w: 60, align: 'left' },
        { key: 'Quantity', x: 314, w: 60, align: 'right' },
        { key: 'Unit', x: 378, w: 40, align: 'left' },
        { key: 'Price/Unit', x: 422, w: 70, align: 'right' },
        { key: 'GST', x: 496, w: 40, align: 'right' },
        { key: 'Amount', x: 540, w: 55, align: 'right' },
      ];
      line(36, y, 559, y); doc.font(headFont).fontSize(9);
      cols.forEach(c => doc.text(c.key, c.x, y + 4, { width: c.w, align: c.align }));
      line(36, y + 20, 559, y + 20); y += 24; doc.font(bodyFont).fontSize(9);
      let subTotal = 0; let gstAmount = 0;
      full.items.forEach((it, idx) => {
        const qty = Number(it.qty) || 0; const price = Number(it.price) || 0; const disc = Number(it.discountPct || 0); const gst = Number(it.gst || 0);
        const preTax = price * qty * (1 - disc/100); const gstVal = preTax * (gst/100); subTotal += preTax; gstAmount += gstVal;
        const row = [String(idx+1), it.title || '-', it.hsn || '-', qty.toFixed(2), it.unit || 'NO', price.toFixed(2), `${gst.toFixed(0)}%`, (preTax+gstVal).toFixed(2)];
        const aligns = ['left','left','left','right','left','right','right','right'];
        row.forEach((v,i)=> doc.text(v, cols[i].x, y, { width: cols[i].w, align: aligns[i] }));
        y += 18; line(36, y, 559, y);
      });
      const serviceCharge = Number(full.serviceCharge||0); const total = subTotal + gstAmount + serviceCharge; const received = total - (full.balance ?? total); const balance = (full.balance ?? 0);
      y += 10; const tx = 380; const tot = (label, val, bold=false)=>{ doc.font(bold?headFont:bodyFont).text(label, tx, y, { width: 100 }); doc.font(bold?headFont:bodyFont).text(money(val), tx+100, y, { width: 79, align:'right' }); y = doc.y + 4; };
      tot('Sub Total', subTotal); tot('IGST@18%', gstAmount); if (serviceCharge) tot('Service Charge', serviceCharge); line(tx, y, 559, y, '#000'); y += 4; tot('Total', total, true); tot('Received', received); tot('Balance', balance); tot('Payment Mode', full.paymentMethod || '-');
      y += 6; doc.font(headFont).text('Pay To', 36, y); y = doc.y + 2; doc.font(bodyFont).text('Bank: HDFC Bank'); doc.text('A/C No: 000000000000'); doc.text('IFSC: HDFC000000'); doc.text('Account Holder: Uday Dairy Equipments');
      const amountWords = `Rupees ${Math.round(total).toLocaleString('en-IN')} only`; y = Math.max(y + 6, doc.y + 6); doc.font(headFont).text('Amount in Words', 36, y); y = doc.y + 2; doc.font(bodyFont).text(amountWords);
      y = doc.y + 8; doc.font(headFont).text('Terms & Conditions', 36, y); y = doc.y + 2; doc.font(bodyFont).fontSize(9).text('1. Goods once sold will not be taken back.', { width: 500 }).text('2. Interest @18% p.a. will be charged if the payment is not made within 15 days.', { width: 500 }).text('3. All disputes are subject to Ahmedabad jurisdiction.', { width: 500 }).text('4. Warranty as per manufacturer terms only.', { width: 500 });
      y = doc.y + 16; doc.font(headFont).text('For Uday Dairy Equipments', 380, y, { align: 'right' }); y += 40; line(420, y, 559, y, '#000'); doc.font(bodyFont).text('Authorized Signatory', 380, y + 6, { align: 'right' });
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#777').text('Original for Recipient', 36, 806, { align: 'left' });
      doc.end();
    });
    try { req.app.get('io')?.emit('invoice.completed', updated); } catch {}
    const url = `/uploads/invoices/${updated.invoiceNo}.pdf`;
    return res.json({ ...updated, pdfUrl: url });
  } catch (e) {
    try { req.app.get('io')?.emit('invoice.completed', updated); } catch {}
    return res.json(updated);
  }
};

export const generateInvoicePdf = async (req, res) => {
  const { invoiceNo } = req.params;
  const inv = await prisma.invoice.findUnique({ where: { invoiceNo }, include: { buyer: true, supplier: true, items: true } });
  if (!inv) return res.status(404).json({ message: 'Not found' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoiceNo}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  doc.pipe(res);

  // Utilities
  const line = (x1, y1, x2, y2, color = '#E5E5E5') => {
    doc.save().lineWidth(0.8).strokeColor(color).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
  };
  const money = (n) => `₹ ${Number(n || 0).toFixed(2)}`;

  // Fonts (use Helvetica family as fallback for PDFKit)
  const titleFont = 'Helvetica-Bold';
  const headFont = 'Helvetica-Bold';
  const bodyFont = 'Helvetica';

  // Header: TAX INVOICE title centered with thin top rule
  let y = doc.y;
  line(36, y, 559, y, '#cccccc');
  doc.font(titleFont).fontSize(18).text('TAX INVOICE', 36, y + 8, { align: 'center' });
  y = doc.y + 8;

  // Company block (top-left)
  const companyName = 'Uday Dairy Equipments';
  const companyAddr = '48/B Vijay Plaza Complex, Kankariya Road, Ahmedabad - 380022';
  const companyTax = 'GSTIN 24AADFU1188L1ZX, State 24 - Gujarat';
  const companyContact = 'Phone 9974396581, Email udaydairyequipments@gmail.com';
  doc.font(headFont).fontSize(10).text(companyName, 36, y);
  doc.font(bodyFont).fontSize(9).fillColor('#333').text(companyAddr, { width: 330 });
  doc.text(companyTax);
  doc.text(companyContact);
  doc.fillColor('#000');

  // Invoice meta (top-right)
  const metaX = 380;
  const dateStr = new Date(inv.createdAt).toLocaleDateString();
  doc.font(headFont).fontSize(10).text(`Invoice No:`, metaX, y);
  doc.font(bodyFont).text(inv.invoiceNo || '-', metaX + 90, y);
  y = doc.y;
  doc.font(headFont).text('Date:', metaX, y);
  doc.font(bodyFont).text(dateStr, metaX + 90, y);
  y = doc.y;
  doc.font(headFont).text('Place of Supply:', metaX, y);
  doc.font(bodyFont).text(inv.buyer?.address ? (inv.buyer.address.split(',').slice(-1)[0] || '-') : '-', metaX + 90, y);

  // Bill To section
  y = Math.max(doc.y + 10, y + 20);
  doc.font(headFont).text('Bill To', 36, y);
  y = doc.y + 2;
  const billTo = [inv.buyer?.name, inv.buyer?.address].filter(Boolean).join('\n');
  doc.font(bodyFont).fontSize(9).text(billTo || '-', 36, y, { width: 300 });

  // Table header
  y = Math.max(y + 36, doc.y + 12);
  const cols = [
    { key: '#', x: 36, w: 20, align: 'left' },
    { key: 'Item Name', x: 60, w: 190, align: 'left' },
    { key: 'HSN/SAC', x: 252, w: 60, align: 'left' },
    { key: 'Quantity', x: 314, w: 60, align: 'right' },
    { key: 'Unit', x: 378, w: 40, align: 'left' },
    { key: 'Price/Unit', x: 422, w: 70, align: 'right' },
    { key: 'GST', x: 496, w: 40, align: 'right' },
    { key: 'Amount', x: 540, w: 55, align: 'right' },
  ];
  line(36, y, 559, y);
  doc.font(headFont).fontSize(9);
  cols.forEach(c => doc.text(c.key, c.x, y + 4, { width: c.w, align: c.align }));
  line(36, y + 20, 559, y + 20);
  y += 24;

  // Table body
  doc.font(bodyFont).fontSize(9);
  let subTotal = 0;
  let gstAmount = 0;
  inv.items.forEach((it, idx) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    const disc = Number(it.discountPct || 0);
    const gst = Number(it.gst || 0);
    const preTax = price * qty * (1 - disc / 100);
    const gstVal = preTax * (gst / 100);
    subTotal += preTax;
    gstAmount += gstVal;

    const row = [
      { v: String(idx + 1), align: 'left' },
      { v: it.title || '-', align: 'left' },
      { v: it.hsn || '-', align: 'left' },
      { v: qty.toFixed(2), align: 'right' },
      { v: it.unit || 'NO', align: 'left' },
      { v: price.toFixed(2), align: 'right' },
      { v: `${gst.toFixed(0)}%`, align: 'right' },
      { v: (preTax + gstVal).toFixed(2), align: 'right' },
    ];
    let cx = 36; const heights = [];
    row.forEach((cell, i) => {
      const col = cols[i];
      const h = doc.heightOfString(cell.v, { width: col.w });
      heights.push(h);
    });
    const rh = Math.max(...heights, 14);
    row.forEach((cell, i) => {
      const col = cols[i];
      doc.text(cell.v, col.x, y, { width: col.w, align: col.align });
      cx += col.w;
    });
    y += rh + 4;
    line(36, y, 559, y);
  });

  const serviceCharge = Number(inv.serviceCharge || 0);
  const total = subTotal + gstAmount + serviceCharge;
  const received = total - (inv.balance ?? total);
  const balance = (inv.balance ?? 0);

  // Totals block (bottom right)
  y += 10;
  const tx = 380; const tw = 179;
  const totRow = (label, value, bold=false) => {
    doc.font(bold? headFont: bodyFont).text(label, tx, y, { width: 100, align: 'left' });
    doc.font(bold? headFont: bodyFont).text(money(value), tx + 100, y, { width: 79, align: 'right' });
    y = doc.y + 4;
  };
  totRow('Sub Total', subTotal);
  totRow('IGST@18%', gstAmount); // label per spec; actual gst aggregated
  if (serviceCharge) totRow('Service Charge', serviceCharge);
  line(tx, y, 559, y, '#000'); y += 4;
  totRow('Total', total, true);
  totRow('Received', received);
  totRow('Balance', balance);
  totRow('Payment Mode', inv.paymentMethod || '-');

  // Bank details / Pay To
  y += 6;
  doc.font(headFont).text('Pay To', 36, y);
  y = doc.y + 2;
  doc.font(bodyFont).text('Bank: HDFC Bank');
  doc.text('A/C No: 000000000000');
  doc.text('IFSC: HDFC000000');
  doc.text('Account Holder: Uday Dairy Equipments');

  // Amount in words (simple)
  const amountWords = `Rupees ${Math.round(total).toLocaleString('en-IN')} only`;
  y = Math.max(y + 6, doc.y + 6);
  doc.font(headFont).text('Amount in Words', 36, y);
  y = doc.y + 2;
  doc.font(bodyFont).text(amountWords);

  // Terms & Conditions
  y = doc.y + 8;
  doc.font(headFont).text('Terms & Conditions', 36, y);
  y = doc.y + 2;
  doc.font(bodyFont).fontSize(9)
    .text('1. Goods once sold will not be taken back.', { width: 500 })
    .text('2. Interest @18% p.a. will be charged if the payment is not made within 15 days.', { width: 500 })
    .text('3. All disputes are subject to Ahmedabad jurisdiction.', { width: 500 })
    .text('4. Warranty as per manufacturer terms only.', { width: 500 });

  // Signature
  y = doc.y + 16;
  doc.font(headFont).text('For Uday Dairy Equipments', 380, y, { align: 'right' });
  y += 40;
  line(420, y, 559, y, '#000');
  doc.font(bodyFont).text('Authorized Signatory', 380, y + 6, { align: 'right' });

  // Footer note
  doc.font('Helvetica-Oblique').fontSize(9).fillColor('#777').text('Original for Recipient', 36, 806, { align: 'left' });
  doc.end();
};

export const downloadInvoicePdf = async (req, res) => {
  const { invoiceNo } = req.params;
  const inv = await prisma.invoice.findUnique({ where: { invoiceNo } });
  if (!inv) return res.status(404).json({ message: 'Not found' });
  const path = await import('node:path');
  const fs = await import('node:fs');
  const filePath = path.resolve(process.cwd(), 'uploads', 'invoices', `${invoiceNo}.pdf`);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  // Fallback: generate on the fly
  return generateInvoicePdf(req, res);
};
