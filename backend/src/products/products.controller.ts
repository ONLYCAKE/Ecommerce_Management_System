import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('products')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class ProductsController {
    constructor(private productsService: ProductsService) { }

    @Get()
    @RequirePermission('product.read')
    findAll(@Query() query: { q?: string; archived?: string }) {
        return this.productsService.findAll(query);
    }

    @Post()
    @RequirePermission('product.create')
    create(@Body() body: any) {
        return this.productsService.create(body);
    }

    @Put(':id')
    @RequirePermission('product.update')
    update(@Param('id') id: string, @Body() body: any) {
        return this.productsService.update(Number(id), body);
    }

    @Delete(':id')
    @RequirePermission('product.delete')
    archive(@Param('id') id: string) {
        return this.productsService.archive(Number(id));
    }

    @Patch(':id/restore')
    @RequirePermission('product.update')
    restore(@Param('id') id: string) {
        return this.productsService.restore(Number(id));
    }

    @Delete(':id/permanent')
    @RequirePermission('product.delete')
    permanentDelete(@Param('id') id: string) {
        return this.productsService.permanentDelete(Number(id));
    }
}
