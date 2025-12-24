import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Res,
    UseGuards,
    ParseIntPipe,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';
import { ProformaInvoicesService } from './proforma-invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { generateProformaPdfContent } from '../services/pdf-generator.service';

@Controller('proforma-invoices')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class ProformaInvoicesController {
    constructor(
        private readonly service: ProformaInvoicesService,
        private readonly prisma: PrismaService,
    ) { }

    @Get()
    @RequirePermission('invoice:read')
    findAll() {
        return this.service.findAll();
    }

    @Post()
    @RequirePermission('invoice:create')
    create(@Body() body: any) {
        return this.service.create(body);
    }

    @Get(':id/pdf')
    @RequirePermission('invoice:read')
    async generatePdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
        const proforma = await this.prisma.proformaInvoice.findUnique({
            where: { id },
            include: { buyer: true, items: true },
        });

        if (!proforma) throw new NotFoundException('Proforma not found');

        await generateProformaPdfContent(proforma, res);
    }

    @Post(':id/convert')
    @RequirePermission('invoice:create')
    convert(@Param('id', ParseIntPipe) id: number) {
        return this.service.convertToInvoice(id);
    }

    @Get(':id')
    @RequirePermission('invoice:read')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
    }

    @Put(':id')
    @RequirePermission('invoice:update')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        return this.service.update(id, body);
    }

    @Delete(':id')
    @RequirePermission('invoice:update')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
