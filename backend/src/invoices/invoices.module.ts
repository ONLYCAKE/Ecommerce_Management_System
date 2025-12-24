import { Module, Global } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoiceStatusService } from '../services/invoice-status.service';

@Global()
@Module({
    controllers: [InvoicesController],
    providers: [InvoicesService, InvoiceStatusService],
    exports: [InvoicesService, InvoiceStatusService],
})
export class InvoicesModule { }
