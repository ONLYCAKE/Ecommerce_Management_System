import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';

@Controller('payments')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class PaymentsController {
    constructor(private paymentsService: PaymentsService) { }

    // GET /api/payments/records
    @Get('records')
    @RequirePermission('invoice.read')
    getAllRecords() {
        return this.paymentsService.findAllRecords();
    }

    // GET /api/payments/invoice/:invoiceNo
    @Get('invoice/:invoiceNo')
    @RequirePermission('invoice.read')
    findByInvoice(@Param('invoiceNo') invoiceNo: string) {
        return this.paymentsService.findByInvoice(invoiceNo);
    }

    // POST /api/payments (with rate limiting)
    @Post()
    @Throttle({ default: { ttl: 60000, limit: 30 } })
    @RequirePermission('invoice.update')
    create(@Body() body: any, @Request() req: { user: AuthUserPayload }) {
        return this.paymentsService.create(body, req.user.id);
    }

    // PUT /api/payments/:id (with rate limiting)
    @Put(':id')
    @Throttle({ default: { ttl: 60000, limit: 30 } })
    @RequirePermission('invoice.update')
    update(@Param('id') id: string, @Body() body: any) {
        return this.paymentsService.update(Number(id), body);
    }

    // DELETE /api/payments/:id (with rate limiting)
    @Delete(':id')
    @Throttle({ default: { ttl: 60000, limit: 30 } })
    @RequirePermission('invoice.update')
    remove(@Param('id') id: string) {
        return this.paymentsService.remove(Number(id));
    }
}
