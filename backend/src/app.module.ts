import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';

// Feature modules will be imported here as they are created
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { BuyersModule } from './buyers/buyers.module';
import { ProductsModule } from './products/products.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { ProformaInvoicesModule } from './proforma-invoices/proforma-invoices.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    // Prisma for database access
    PrismaModule,

    // Rate limiting (matching backend-v2 rateLimit middleware)
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100,  // 100 requests per minute
    }]),

    // Feature modules (uncomment as implemented)
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    SuppliersModule,
    BuyersModule,
    ProductsModule,
    InvoicesModule,
    PaymentsModule,
    ProformaInvoicesModule,
    StatsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
