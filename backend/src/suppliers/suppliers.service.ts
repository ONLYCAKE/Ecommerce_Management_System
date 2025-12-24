import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
    constructor(private prisma: PrismaService) { }

    // Matching backend-v2 routes/suppliers.ts GET / (lines 9-29)
    async findAll(query: { q?: string; sortBy?: string; dir?: string; archived?: string }) {
        const { q = '', sortBy = 'id', dir = 'desc', archived = 'false' } = query;
        const allowedSortFields = ['name', 'email', 'phone', 'id'];
        const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'id';
        const validDir = dir === 'asc' ? 'asc' : 'desc';
        const isArchived = archived === 'true';

        const where: any = { isArchived };
        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
            ];
        }

        const items = await this.prisma.supplier.findMany({
            where,
            orderBy: { [validSortBy]: validDir },
        });
        return items;
    }

    // Matching backend-v2 routes/suppliers.ts POST / (lines 31-48)
    async create(dto: any) {
        const item = await this.prisma.supplier.create({
            data: {
                name: dto.name,
                email: dto.email,
                phone: dto.phone,
                addressLine1: dto.addressLine1 || '',
                addressLine2: dto.addressLine2,
                area: dto.area || '',
                city: dto.city || '',
                state: dto.state || '',
                country: dto.country || '',
                postalCode: dto.postalCode || '',
            },
        });
        return item;
    }

    // Matching backend-v2 routes/suppliers.ts PUT /:id (lines 50-76)
    async update(id: number, dto: any) {
        const item = await this.prisma.supplier.update({
            where: { id },
            data: {
                name: dto.name,
                email: dto.email,
                phone: dto.phone,
                addressLine1: dto.addressLine1 || '',
                addressLine2: dto.addressLine2 || '',
                area: dto.area || '',
                city: dto.city || '',
                state: dto.state || '',
                country: dto.country || '',
                postalCode: dto.postalCode || '',
            },
        });
        return item;
    }

    // Matching backend-v2 routes/suppliers.ts DELETE /:id (lines 78-91) - Soft delete
    async archive(id: number) {
        await this.prisma.supplier.update({
            where: { id },
            data: { isArchived: true },
        });
        return { ok: true };
    }

    // Matching backend-v2 routes/suppliers.ts PATCH /:id/restore (lines 93-106)
    async restore(id: number) {
        const supplier = await this.prisma.supplier.update({
            where: { id },
            data: { isArchived: false },
        });
        return supplier;
    }

    // Matching backend-v2 routes/suppliers.ts DELETE /:id/permanent (lines 108-128)
    async permanentDelete(id: number) {
        const [invoiceCount, productCount] = await Promise.all([
            this.prisma.invoice.count({ where: { supplierId: id } }),
            this.prisma.product.count({ where: { supplierId: id } }),
        ]);
        if (invoiceCount > 0 || productCount > 0) {
            throw new ConflictException('Cannot delete supplier while related products or invoices exist. Remove/reassign them first.');
        }
        await this.prisma.supplier.delete({ where: { id } });
        return { ok: true };
    }
}
