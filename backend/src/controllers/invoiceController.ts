import type { Request, Response } from 'express';
import { prisma } from '../prisma';
import {
  sendInvoiceEmail as sendAutoEmail,
  sendCustomInvoiceEmail,
  generatePlaceholderPDF,
} from '../services/emailService';
import { sendReminder, sendBulkReminders, getReminderHistory } from '../services/reminderService';

import { recalculateAndUpdateInvoiceStatus } from '../services/invoiceStatusService';
import { roundToTwoDecimals } from '../config/roundOffConfig';

/* ----------------------------- GET ALL INVOICES ----------------------------- */
export const getAllInvoices = async (req: Request, res: Response) => {
  try {
    const { status, paymentMethod, sortBy, sortOrder, date, dateFrom, dateTo, partyName } = req.query as any;

    // Build where clause
    const where: any = {};

    // OPTIMIZED: Filter by database status field (indexed for performance)
    // Status is now always kept in sync by InvoiceStatusService
    if (status && status !== 'All') {
      where.status = status;  // Direct DB filter using indexed field
    }

    if (paymentMethod) {
      const methods = paymentMethod.split(',');
      where.paymentMethod = { in: methods };
    }

    // Date range filtering (for Sale Report / Daybook Report)
    if (dateFrom && dateTo) {
      // Parse date strings as local dates (YYYY-MM-DD format)
      const [fromYear, fromMonth, fromDay] = dateFrom.split('-').map(Number);
      const [toYear, toMonth, toDay] = dateTo.split('-').map(Number);

      const startDate = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
      const endDate = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

      console.log(`[DEBUG] Invoice Date filter: ${dateFrom} to ${dateTo}`);

      // Filter by invoiceDate (the actual invoice date, not createdAt)
      where.invoiceDate = {
        gte: startDate,
        lte: endDate
      };
    } else if (date) {
      // Single date filtering (legacy)
      const filterDate = new Date(date);
      const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));

      where.createdAt = {
        gte: startOfDay,
        lte: endOfDay
      };
    }

    // Party name search filtering
    if (partyName) {
      where.buyer = {
        name: { contains: partyName, mode: 'insensitive' as any }
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

    // Calculate received amount for display (status and balance already correct from DB)
    const itemsWithPayments = items.map(inv => {
      const receivedAmount = inv.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      return {
        ...inv,
        receivedAmount,
        // balance already correct from DB (maintained by InvoiceStatusService)
      };
    });

    res.json(itemsWithPayments);
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

    // OPTIMIZED: Use database status field directly
    if (status && status !== 'All') {
      where.status = status;
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
      receivedAmount: inv.payments.reduce((sum: number, p: any) => sum + p.amount, 0)
    }));

    // Calculate aggregates from filtered invoices
    let totalSales = 0;
    let totalReceived = 0;
    let totalBalance = 0;

    invoicesWithPayments.forEach(inv => {
      const receivedAmount = inv.receivedAmount;
      totalSales += inv.total;
      totalReceived += receivedAmount;
      totalBalance += (inv.total - receivedAmount);
    });

    res.json({
      totalSales,
      totalReceived,
      totalBalance,
      count: invoicesWithPayments.length
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
    const {
      invoiceNo,
      buyerId,
      paymentMethod = null,  // DEPRECATED - kept for backward compatibility
      status = 'Processing',  // Will be overridden by status service
      items = [],
      serviceCharge = 0,
      payments = [],  // NEW: Array of payments
      receivedAmount = 0  // DEPRECATED - for backward compatibility
    } = body;

    if (!invoiceNo || !buyerId) {
      return res.status(400).json({ message: 'Invoice number and buyer are required.' });
    }

    // Normalize items
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

    const rawTotal = normalized.reduce((s, it) => s + it.amount, 0) + Number(serviceCharge || 0);
    const total = roundToTwoDecimals(rawTotal); // Apply consistent rounding before DB save

    // Derive supplier from first product
    let derivedSupplierId: number | null = null;
    const firstProduct = (items as any[]).find(n => n.productId);
    if (firstProduct) {
      const prod = await prisma.product.findUnique({ where: { id: Number(firstProduct.productId) } });
      derivedSupplierId = (prod?.supplierId as number | undefined) ?? null;
    }

    // Backward compatibility: convert old receivedAmount to payments array
    let paymentsToCreate = payments.length > 0 ? payments : [];
    if (receivedAmount > 0 && payments.length === 0) {
      console.warn('[DEPRECATED] Using receivedAmount parameter. Please migrate to payments[] array.');
      paymentsToCreate = [{
        amount: receivedAmount,
        roundOff: 0,
        mode: paymentMethod || 'Cash',
        note: `Initial payment for ${invoiceNo}`
      }];
    }

    // Use transaction for atomicity
    const invoiceId = await prisma.$transaction(async (tx) => {
      // Generate temporary invoice number for Draft, use provided number for others
      const finalInvoiceNo = body.status === 'Draft'
        ? `DRAFT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        : invoiceNo;

      // Create invoice with initial status (will be recalculated)
      const invoiceData: any = {
        invoiceNo: finalInvoiceNo,
        buyer: { connect: { id: Number(buyerId) } },
        paymentMethod: paymentMethod as any,  // DEPRECATED - for backward compatibility only
        status: body.status === 'Draft' ? 'Draft' : 'Unpaid',  // Accept Draft status from request
        total,
        balance: total,  // Initial balance, will be recalculated by service
        serviceCharge: Number(serviceCharge || 0),
        signature: body.signature || null,
        items: { create: normalized as any },
      };

      // Only add supplier if it exists
      if (derivedSupplierId) {
        invoiceData.supplier = { connect: { id: derivedSupplierId } };
      }

      const invoice = await tx.invoice.create({
        data: invoiceData,
      });

      // Create all payments (if any)
      const userId = (req as any).user?.id || 1;
      for (const payment of paymentsToCreate) {
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: Number(payment.amount),
            roundOff: Number(payment.roundOff || 0),
            method: payment.mode || payment.method || 'Cash',
            reference: payment.note || payment.reference || `Payment for ${invoiceNo}`,
            createdBy: userId,
          } as any,  // Type assertion for roundOff field
        });
      }

      // Recalculate status based on payments (SINGLE SOURCE OF TRUTH)
      await recalculateAndUpdateInvoiceStatus(invoice.id, {
        skipEmit: true,  // Will emit after transaction
        transaction: tx
      });

      return invoice.id;
    });

    // Fetch created invoice with all includes
    const created = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { buyer: true, supplier: true, items: { include: { product: true } } },
    });

    if (!created) {
      throw new Error('Failed to fetch created invoice');
    }

    // Send email if invoice is not Draft
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
      }
    }

    // Emit events after successful transaction
    (req.app as any).get('io')?.emit('invoice.created', {
      id: created.id,
      invoiceNo: created.invoiceNo,
      total: created.total,
    });

    // Recalculate status one more time to emit proper event
    await recalculateAndUpdateInvoiceStatus(created.id);

    res.status(201).json(created);
  } catch (err: any) {
    console.error('[ERROR] createInvoice:', err);
    res.status(500).json({ message: 'Failed to create invoice', error: err.message });
  }
};

/* ------------------------------- UPDATE INVOICE ----------------------------- */
export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const { invoiceNo } = req.params as { invoiceNo: string };
    const body = req.body as any;
    const { buyerId, supplierId, paymentMethod, status, items, serviceCharge, signature } = body;

    // Fetch existing invoice with payments
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNo },
      include: { payments: true }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // VALIDATE: Cannot update cancelled invoices
    if (existing.status === 'Cancelled') {
      return res.status(400).json({
        message: 'Cannot update cancelled invoice. Please restore it first using the cancel/restore feature.'
      });
    }

    // VALIDATE: Cannot manually change status
    if (status && status !== existing.status) {
      return res.status(400).json({
        message: 'Status cannot be changed manually. It is automatically calculated based on payments.'
      });
    }

    // Calculate new total if items are provided
    let newTotal: number | undefined;
    let normalized: any[] | undefined;

    if (Array.isArray(items)) {
      normalized = (items as any[])
        .filter(it => (it.title || it.productId) && Number(it.qty) > 0)
        .map(it => ({
          ...(it.productId ? { productId: Number(it.productId) } : {}),
          title: it.title || 'Untitled Item',
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

      const rawNewTotal = normalized.reduce((s, it) => s + it.amount, 0) + Number(serviceCharge || 0);
      newTotal = roundToTwoDecimals(rawNewTotal); // Apply consistent rounding before DB save
    }

    // VALIDATE: If total is being reduced, check against payments
    if (newTotal !== undefined && newTotal !== existing.total) {
      const receivedAmount = existing.payments.reduce((sum: number, p: any) => sum + p.amount, 0);

      if (newTotal < receivedAmount) {
        return res.status(400).json({
          message: `Cannot reduce invoice total to ₹${newTotal.toFixed(2)} as ₹${receivedAmount.toFixed(2)} has already been paid. Please delete or adjust payments first.`
        });
      }
    }

    // Use transaction for atomicity
    const updated = await prisma.$transaction(async (tx) => {
      // Delete existing items if updating
      if (normalized) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
      }

      // Prepare update data
      const updateData: any = {
        ...(buyerId && { buyer: { connect: { id: Number(buyerId) } } }),
        ...(supplierId && { supplier: { connect: { id: Number(supplierId) } } }),
        ...(paymentMethod && { paymentMethod: paymentMethod as any }),  // DEPRECATED
        ...(signature !== undefined && { signature }),
        ...(serviceCharge !== undefined && { serviceCharge: Number(serviceCharge) }),
        ...(normalized && { items: { create: normalized } }),
        ...(newTotal !== undefined && { total: newTotal }),
      };

      // Update invoice
      const inv = await tx.invoice.update({
        where: { id: existing.id },
        data: updateData,
      });

      // Recalculate status if total changed
      if (newTotal !== undefined && newTotal !== existing.total) {
        await recalculateAndUpdateInvoiceStatus(inv.id, {
          skipEmit: true,
          transaction: tx
        });
      }

      return inv.id;
    });

    // Fetch updated invoice with all includes
    const result = await prisma.invoice.findUnique({
      where: { id: updated },
      include: { buyer: true, supplier: true, items: { include: { product: true } } },
    });

    if (!result) {
      throw new Error('Failed to fetch updated invoice');
    }

    // Emit event
    (req.app as any).get('io')?.emit('invoice.updated', {
      id: result.id,
      invoiceNo: result.invoiceNo,
    });

    // Recalculate status again to emit proper event
    if (newTotal !== undefined && newTotal !== existing.total) {
      await recalculateAndUpdateInvoiceStatus(result.id);
    }

    res.json(result);
  } catch (err: any) {
    console.error('[ERROR] updateInvoice:', err);
    res.status(500).json({ message: 'Failed to update invoice', error: err.message });
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

/* --------------------------- GENERATE INVOICE PDF (PROFESSIONAL DESIGN) --------------------------- */
export const generateInvoicePdf = async (req: Request, res: Response) => {
  const { invoiceNo } = req.params as { invoiceNo: string };

  try {
    const inv = await prisma.invoice.findUnique({
      where: { invoiceNo },
      include: { buyer: true, supplier: true, items: true, payments: true },
    });

    if (!inv) return res.status(404).json({ message: 'Invoice not found' });

    // Block PDF generation for Draft invoices
    if (inv.status === 'Draft') {
      return res.status(400).json({
        message: 'Cannot generate PDF for draft invoice. Please finalize the invoice first.'
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoiceNo}.pdf"`);

    const PDFDocument = (await import('pdfkit')).default;
    const fs = await import('fs');
    const path = await import('path');

    const doc = new PDFDocument({ size: 'A4', margin: 50 } as any);
    doc.pipe(res as any);

    // ========== DESIGN CONSTANTS ==========
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
    const formatDate = (d: Date) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });

    let y = MARGIN;

    // ========== COMPANY HEADER WITH LOGO ==========
    // Try to load company logo
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

    // Column positions (optimized for clean layout with wider value columns)
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
      taxable: 95  // Wider to fit currency values like ₹1,77,000.00
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

    // ========== TOTALS (Right aligned, aligned with table columns) ==========

    // Position totals to align with Rate and Taxable Value columns
    const totalsStartX = cols.rate;  // Start at Rate column
    const totalsLabelWidth = cols.taxable - cols.rate - 5;  // Label spans Rate to before Taxable
    const totalsValueWidth = colWidths.taxable + 5;  // Same width as Taxable column + padding
    const totalsRowHeight = 22;

    // Use database total as single source of truth
    const grandTotal = Number(inv.total);
    const sgst = totalTax / 2;
    const cgst = totalTax / 2;

    const totalReceived = (inv.payments as any[]).reduce((sum, p) => sum + (p.amount || 0), 0);
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

    // Grand Total row (prominent with background)
    const grandTotalBoxWidth = totalsLabelWidth + totalsValueWidth + 15;
    doc.rect(totalsStartX - 5, y, grandTotalBoxWidth, 24).fill('#e8f4fd');
    doc.strokeColor(COLORS.border).rect(totalsStartX - 5, y, grandTotalBoxWidth, 24).stroke();
    doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(10);
    doc.text('Grand Total:', totalsStartX, y + 6, { width: totalsLabelWidth, align: 'right' });
    doc.fontSize(11);
    doc.text(money(grandTotal), totalsStartX + totalsLabelWidth + 5, y + 5, { width: totalsValueWidth, align: 'right' });
    y += 28;

    // Amount Payable (if balance differs from total)
    if (balance !== grandTotal && balance > 0) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary);
      doc.text('Amount Payable:', totalsStartX, y + 5, { width: totalsLabelWidth, align: 'right' });
      doc.text(money(balance), totalsStartX + totalsLabelWidth + 5, y + 5, { width: totalsValueWidth, align: 'right' });
      y += totalsRowHeight;
    }

    y += 15;

    // ========== PAYMENT HISTORY (if payments exist) ==========
    const payments = inv.payments as any[];
    if (payments.length > 0) {
      // Section header with border
      doc.rect(MARGIN, y, CONTENT_WIDTH, 22).fill(COLORS.headerBg);
      doc.strokeColor(COLORS.border).rect(MARGIN, y, CONTENT_WIDTH, 22).stroke();
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10);
      doc.text('Payment History', MARGIN + 10, y + 6);
      y += 22;

      // Payment table header
      const payColDate = MARGIN + 10;
      const payColAmount = MARGIN + 150;
      const payColNotes = MARGIN + 280;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.textLight);
      doc.text('Date', payColDate, y + 6);
      doc.text('Amount', payColAmount, y + 6);
      doc.text('Notes', payColNotes, y + 6);
      y += 20;

      // Payment rows
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
      payments.forEach(p => {
        doc.text(formatDate(p.receivedAt || p.createdAt), payColDate, y);
        doc.text(money(p.amount), payColAmount, y);
        doc.text(p.reference || '-', payColNotes, y);
        y += 16;
      });

      y += 10;
    }

    // ========== TERMS AND CONDITIONS ==========
    // Check for page break
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

    // Check if fully paid
    if (balance <= 0) {
      terms.unshift('Payment completed in full.');
    }

    terms.forEach(term => {
      doc.text(term, MARGIN + 10, y, { width: CONTENT_WIDTH - 20 });
      y += 12;
    });

    y += 30;

    // ========== AUTHORIZED SIGNATORY ==========
    // Check for page break
    if (y > PAGE_HEIGHT - 100) {
      doc.addPage();
      y = MARGIN;
    }

    const sigX = PAGE_WIDTH - MARGIN - 180;
    const sigWidth = 180;

    // Company name (centered in signature area)
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    doc.text('For UDAY DAIRY EQUIPMENTS', sigX, y, { width: sigWidth, align: 'center' });
    y += 12;

    // Signature image (centered with proper spacing)
    const signatureData = (inv as any).signature;
    const sigImgWidth = 100;
    const sigImgX = sigX + (sigWidth - sigImgWidth) / 2; // Center horizontally

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
        // Signature rendering failed, leave space
        y += 50;
      }
    } else {
      // No signature uploaded, leave space for manual signature
      y += 50;
    }

    // Signature line (centered)
    const lineWidth = 140;
    const lineX = sigX + (sigWidth - lineWidth) / 2;
    doc.strokeColor(COLORS.text).lineWidth(0.5);
    doc.moveTo(lineX, y).lineTo(lineX + lineWidth, y).stroke();
    y += 8;

    // Authorized Signatory label (centered)
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text('Authorized Signatory', sigX, y, { width: sigWidth, align: 'center' });

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
    const pageHeight = 841.89; // A4 height in points
    const margin = 35;
    const contentWidth = pageWidth - margin * 2;
    const minBottomMargin = 50; // Minimum space needed at bottom for totals

    // Optimized column positions to fit within contentWidth (525.28pt)
    // #: 15pt, Item Description: 200pt, Rate: 55pt, Qty: 35pt, Taxable: 60pt, Tax: 70pt
    const col = {
      idx: margin,
      itemX: margin + 20,
      rateX: margin + 225,
      qtyX: margin + 285,
      taxableX: margin + 325,
      taxX: margin + 390,
    };
    const itemDescWidth = col.rateX - col.itemX - 5; // Item description width (200pt)
    const taxWidth = (margin + contentWidth) - col.taxX - 5; // Tax column width (90pt)

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
    doc.text('Item Description', col.itemX, tableTop + 7, { width: itemDescWidth });
    doc.text('Rate', col.rateX, tableTop + 7, { width: col.qtyX - col.rateX - 5, align: 'right' });
    doc.text('Qty', col.qtyX, tableTop + 7, { width: col.taxableX - col.qtyX - 5, align: 'right' });
    doc.text('Taxable', col.taxableX, tableTop + 7, { width: col.taxX - col.taxableX - 5, align: 'right' });
    doc.text('Tax', col.taxX, tableTop + 7, { width: taxWidth, align: 'right' });

    y = tableTop + headerHeight + 6;
    doc.strokeColor('#DDDDDD').lineWidth(0.5).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
    y += 6;

    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    let taxableTotal = 0;
    let taxTotal = 0;

    (inv.items as any[]).forEach((item, i) => {
      // Check if we need a new page before rendering this row
      // Reserve space for row (up to 28pt if has description) + potential totals section (at least 150pt)
      const rowHeight = (item.hsnCode || item.description) ? 28 : 18;
      if (y + rowHeight + 6 + 150 > pageHeight - minBottomMargin) {
        doc.addPage();
        y = margin;

        // Redraw table header on new page
        doc.rect(margin, y, contentWidth, headerHeight).fill('#E8F0FE');
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9);
        doc.text('#', col.idx + 2, y + 7);
        doc.text('Item Description', col.itemX, y + 7, { width: itemDescWidth });
        doc.text('Rate', col.rateX, y + 7, { width: col.qtyX - col.rateX - 5, align: 'right' });
        doc.text('Qty', col.qtyX, y + 7, { width: col.taxableX - col.qtyX - 5, align: 'right' });
        doc.text('Taxable', col.taxableX, y + 7, { width: col.taxX - col.taxableX - 5, align: 'right' });
        doc.text('Tax', col.taxX, y + 7, { width: taxWidth, align: 'right' });
        y += headerHeight + 6;
        doc.strokeColor('#DDDDDD').lineWidth(0.5).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
        y += 6;
        doc.font('Helvetica').fontSize(9).fillColor('#000000');
      }

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
      doc.text(item.title || 'Sample Product', col.itemX, y, { width: itemDescWidth, ellipsis: true });

      if (item.hsnCode || item.description) {
        const desc = `HSN: ${item.hsnCode || '—'}${item.description ? ' — ' + String(item.description).slice(0, 50) : ''}`;
        doc.font('Helvetica').fontSize(8).fillColor('#666666').text(desc, col.itemX, y + 12, { width: itemDescWidth });
        doc.font('Helvetica').fontSize(9).fillColor('#000000');
      }

      doc.text(money(price), col.rateX, y, { width: col.qtyX - col.rateX - 5, align: 'right' });
      doc.text(String(qty), col.qtyX, y, { width: col.taxableX - col.qtyX - 5, align: 'right' });
      doc.text(money(lineTaxable), col.taxableX, y, { width: col.taxX - col.taxableX - 5, align: 'right' });
      doc.text(`${money(lineTax)}`, col.taxX, y, { width: taxWidth, align: 'right' });

      y += rowHeight;
      doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
      y += 6;
    });

    y += 6;
    // Calculate grand total and round it consistently
    const grandTotal = taxableTotal + taxTotal;
    const roundedGrandTotal = Math.round(grandTotal);
    const roundOff = roundedGrandTotal - grandTotal;

    // Check if totals section fits on current page (needs ~120pt)
    const totalsSectionHeight = 120;
    if (y + totalsSectionHeight > pageHeight - minBottomMargin) {
      doc.addPage();
      y = margin;
    }

    const totalsLabelX = col.taxableX - 110;
    const totalsValueX = col.taxX;

    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    doc.text('Taxable Amount:', totalsLabelX, y, { width: 100, align: 'right' });
    doc.text(money(taxableTotal), totalsValueX, y, { width: taxWidth, align: 'right' });
    y += 16;

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total', totalsLabelX, y, { width: 100, align: 'right' });
    doc.text(money(roundedGrandTotal), totalsValueX, y, { width: taxWidth, align: 'right' });

    const underlineY = y + 12;
    doc.strokeColor('#000000').lineWidth(1).moveTo(margin, underlineY).lineTo(margin + contentWidth, underlineY).stroke();

    let afterUnderlineY = underlineY + 10;
    doc.font('Helvetica').fontSize(8).fillColor('#666666');
    const amountWords = `Total amount (in words): INR ${roundedGrandTotal.toLocaleString('en-IN')} Rupees Only.`;
    doc.text(amountWords, margin, afterUnderlineY, { width: Math.max(220, contentWidth - 320) });

    doc.fillColor('#000000').font('Helvetica').fontSize(9);
    doc.text('Amount Payable:', totalsLabelX, afterUnderlineY, { width: 100, align: 'right' });
    doc.font('Helvetica-Bold').text(money(roundedGrandTotal), totalsValueX, afterUnderlineY, { width: taxWidth, align: 'right' });

    y = afterUnderlineY + 24;

    // PAYMENT RECORDS SECTION - Show for Partial and Paid invoices
    const payments = (inv as any).payments || [];
    const totalReceived = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const remainingBalance = roundedGrandTotal - totalReceived;

    if (payments.length > 0 && (inv.status === 'Partial' || inv.status === 'Paid')) {
      // Check if payment records section fits (needs ~100pt)
      const paymentSectionHeight = 100;
      if (y + paymentSectionHeight > pageHeight - minBottomMargin) {
        doc.addPage();
        y = margin;
      }

      y += 12;

      // Payment Records Title
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Payment Records', margin, y);
      y += 16;

      // Payment Records Table - ensure it fits within contentWidth
      const payTableWidth = 300; // Total table width
      let payTableX = margin + contentWidth - payTableWidth;
      let payLabelWidth = 150;
      let payValueWidth = 150;

      // Ensure table doesn't overflow - adjust if needed
      if (payTableX < margin) {
        // If table is too wide, reduce width and align left
        payTableX = margin + 10;
        const adjustedWidth = contentWidth - 20; // Leave 10pt margin on each side
        payLabelWidth = adjustedWidth / 2;
        payValueWidth = adjustedWidth / 2;
      }

      // Table styling
      doc.rect(payTableX, y, payLabelWidth + payValueWidth, 14).fillAndStroke('#D32F2F', '#D32F2F');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      doc.text('Total', payTableX + 5, y + 3, { width: payLabelWidth - 10 });
      doc.text(money(roundedGrandTotal), payTableX + payLabelWidth, y + 3, { width: payValueWidth, align: 'right' });
      y += 14;

      // Received row
      doc.rect(payTableX, y, payLabelWidth + payValueWidth, 14).fillAndStroke('#FFFFFF', '#000000');
      doc.fillColor('#000000').font('Helvetica').fontSize(9);
      doc.text('Received', payTableX + 5, y + 3, { width: payLabelWidth - 10 });
      doc.text(money(totalReceived), payTableX + payLabelWidth, y + 3, { width: payValueWidth, align: 'right' });
      y += 14;

      // Balance row
      doc.rect(payTableX, y, payLabelWidth + payValueWidth, 14).fillAndStroke('#FFFFFF', '#000000');
      doc.fillColor('#000000').font('Helvetica').fontSize(9);
      doc.text('Balance', payTableX + 5, y + 3, { width: payLabelWidth - 10 });
      doc.text(money(remainingBalance), payTableX + payLabelWidth, y + 3, { width: payValueWidth, align: 'right' });
      y += 14;

      // Payment Modes row (show all unique payment methods)
      const paymentModes = payments.map((p: any) => p.method).filter((m: string) => m).join(', ') || 'N/A';
      doc.rect(payTableX, y, payLabelWidth + payValueWidth, 14).fillAndStroke('#FFFFFF', '#000000');
      doc.fillColor('#000000').font('Helvetica').fontSize(9);
      doc.text('Payment Mode', payTableX + 5, y + 3, { width: payLabelWidth - 10 });
      doc.text(paymentModes, payTableX + payLabelWidth, y + 3, { width: payValueWidth - 10, align: 'right' });
      y += 14;

      y += 8;
    }

    y += 12;

    // Check if terms section fits (needs ~80pt)
    const termsSectionHeight = 80;
    if (y + termsSectionHeight > pageHeight - minBottomMargin) {
      doc.addPage();
      y = margin;
    }

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Terms And Conditions', margin, y);
    y += 14;
    doc.font('Helvetica').fontSize(8).fillColor('#333333');
    const terms = [
      '1) Goods once sold will not be taken back or exchange.',
      '2) We are not responsible for damage, shortage or breakage after despatched from our premises.',
      '3) We are not responsible for given guarantee or warranty by the principle of electric & electronics items.',
      '4) Subject to Ahmedabad Jurisdiction. [E&OE]'
    ];
    terms.forEach((t) => {
      // Check if term will fit on current page
      if (y + 12 > pageHeight - minBottomMargin) {
        doc.addPage();
        y = margin;
      }
      doc.text(t, margin, y, { width: contentWidth - 30 });
      y += 12;
    });

    y += 18;

    // Check if signature section fits (needs ~80pt)
    if (y + 80 > pageHeight - minBottomMargin) {
      doc.addPage();
      y = margin;
    }

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



/* ------------------------------- FINALIZE DRAFT INVOICE ----------------------------- */
export const finalizeInvoice = async (req: Request, res: Response) => {
  const { invoiceNo } = req.params;

  try {
    // 1. Find draft invoice
    const draft = await prisma.invoice.findUnique({
      where: { invoiceNo },
      include: { items: true, buyer: true, supplier: true }
    });

    if (!draft) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (draft.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft invoices can be finalized. This invoice is already ' + draft.status });
    }

    // 2. Validate required fields
    if (!draft.buyerId || draft.items.length === 0) {
      return res.status(400).json({ message: 'Invoice must have a buyer and at least one item' });
    }

    // 3. Generate real invoice number (exclude drafts from sequence)
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${y}${m}-`;

    const last = await prisma.invoice.findFirst({
      where: {
        invoiceNo: { startsWith: prefix },
        status: { not: 'Draft' }  // Exclude drafts from sequence
      },
      orderBy: { createdAt: 'desc' },
    });

    let nextCounter = 1;
    if (last?.invoiceNo) {
      const seq = last.invoiceNo.split('-')[2] || '0000';
      const n = parseInt(seq, 10);
      if (!Number.isNaN(n)) nextCounter = n + 1;
    }

    const newInvoiceNo = `${prefix}${String(nextCounter).padStart(4, '0')}`;

    // 4. Update invoice to Unpaid with new invoice number
    const finalized = await prisma.invoice.update({
      where: { id: draft.id },
      data: {
        invoiceNo: newInvoiceNo,
        status: 'Unpaid'
      },
      include: { buyer: true, supplier: true, items: { include: { product: true } } }
    });

    // 5. Recalculate status (will be Unpaid since no payments on draft)
    await recalculateAndUpdateInvoiceStatus(finalized.id);

    // 6. Send email if buyer has email
    if (finalized.buyer?.email) {
      try {
        const pdfBuffer = generatePlaceholderPDF(finalized.invoiceNo);
        await sendAutoEmail({
          to: finalized.buyer.email,
          pdfBuffer,
          fileName: `${finalized.invoiceNo}.pdf`,
        });
        console.log(`✅ Invoice finalized and email sent to ${finalized.buyer.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send email after finalization (non-blocking):', emailError);
      }
    }

    // 7. Emit event
    (req.app as any).get('io')?.emit('invoice.updated', finalized);

    res.json(finalized);
  } catch (err: any) {
    console.error('[ERROR] finalizeInvoice:', err);
    res.status(500).json({ message: err.message || 'Failed to finalize invoice' });
  }
};


