import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuppliersService } from './suppliers.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class SuppliersController {
    constructor(private suppliersService: SuppliersService) { }

    @Get()
    @RequirePermission('supplier.read')
    findAll(@Query() query: { q?: string; sortBy?: string; dir?: string; archived?: string }) {
        return this.suppliersService.findAll(query);
    }

    @Post()
    @RequirePermission('supplier.create')
    create(@Body() body: any) {
        return this.suppliersService.create(body);
    }

    @Put(':id')
    @RequirePermission('supplier.update')
    update(@Param('id') id: string, @Body() body: any) {
        return this.suppliersService.update(Number(id), body);
    }

    @Delete(':id')
    @RequirePermission('supplier.delete')
    archive(@Param('id') id: string) {
        return this.suppliersService.archive(Number(id));
    }

    @Patch(':id/restore')
    @RequirePermission('supplier.update')
    restore(@Param('id') id: string) {
        return this.suppliersService.restore(Number(id));
    }

    @Delete(':id/permanent')
    @RequirePermission('supplier.delete')
    permanentDelete(@Param('id') id: string) {
        return this.suppliersService.permanentDelete(Number(id));
    }
}
