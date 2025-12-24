import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BuyersService } from './buyers.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';

@Controller('buyers')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class BuyersController {
    constructor(private buyersService: BuyersService) { }

    @Get()
    @RequirePermission('buyer.read')
    findAll(@Query() query: { q?: string; sortBy?: string; dir?: string; archived?: string }) {
        return this.buyersService.findAll(query);
    }

    @Post()
    @RequirePermission('buyer.create')
    create(@Body() body: any) {
        return this.buyersService.create(body);
    }

    @Put(':id')
    @RequirePermission('buyer.update')
    update(@Param('id') id: string, @Body() body: any) {
        return this.buyersService.update(Number(id), body);
    }

    @Delete(':id')
    @RequirePermission('buyer.delete')
    archive(@Param('id') id: string) {
        return this.buyersService.archive(Number(id));
    }

    @Patch(':id/restore')
    @RequirePermission('buyer.update')
    restore(@Param('id') id: string) {
        return this.buyersService.restore(Number(id));
    }

    @Delete(':id/permanent')
    @RequirePermission('buyer.delete')
    permanentDelete(@Param('id') id: string) {
        return this.buyersService.permanentDelete(Number(id));
    }
}
