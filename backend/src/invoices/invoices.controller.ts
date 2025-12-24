import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request, Res, NotFoundException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';
import { generateInvoicePdfContent } from '../services/pdf-generator.service';

@Controller('invoices')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class InvoicesController {
    constructor(
        private invoicesService: InvoicesService,
        private prisma: PrismaService,
    ) { }

    // GET /api/invoices
    @Get()
    @RequirePermission('invoice.read')
    findAll(@Query() query: any) {
        return this.invoicesService.findAll(query);
    }

    // GET /api/invoices/next-no
    @Get('next-no')
    @RequirePermission('invoice.create')
    getNextInvoiceNo() {
        return this.invoicesService.getNextInvoiceNo();
    }

    // GET /api/invoices/summary
    @Get('summary')
    @RequirePermission('invoice.read')
    getSummary(@Query() query: any) {
        return this.invoicesService.getSummary(query);
    }

    // GET /api/invoices/generate/:invoiceNo - PDF generation
    @Get('generate/:invoiceNo')
    @RequirePermission('invoice.read')
    async generatePdf(@Param('invoiceNo') invoiceNo: string, @Res() res: Response) {
        const inv = await this.prisma.invoice.findUnique({
            where: { invoiceNo },
            include: { buyer: true, supplier: true, items: true, payments: true },
        });

        if (!inv) throw new NotFoundException('Invoice not found');
        if (inv.status === 'Draft') {
            throw new BadRequestException('Cannot generate PDF for draft invoice. Please finalize the invoice first.');
        }

        await generateInvoicePdfContent(inv, res);
    }

    // POST /api/invoices
    @Post()
    @RequirePermission('invoice.create')
    create(@Body() body: any, @Request() req: { user: AuthUserPayload }) {
        return this.invoicesService.create(body, req.user.id);
    }

    // PUT /api/invoices/:invoiceNo
    @Put(':invoiceNo')
    @RequirePermission('invoice.update')
    update(@Param('invoiceNo') invoiceNo: string, @Body() body: any) {
        return this.invoicesService.update(invoiceNo, body);
    }

    // POST /api/invoices/:invoiceNo/finalize
    @Post(':invoiceNo/finalize')
    @RequirePermission('invoice.update')
    finalize(@Param('invoiceNo') invoiceNo: string) {
        return this.invoicesService.finalize(invoiceNo);
    }

    // GET /api/invoices/:invoiceNo (must be last to avoid shadowing)
    @Get(':invoiceNo')
    @RequirePermission('invoice.read')
    findByNo(@Param('invoiceNo') invoiceNo: string) {
        return this.invoicesService.findByNo(invoiceNo);
    }
}
