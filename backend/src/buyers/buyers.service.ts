import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BuyersService {
    constructor(private prisma: PrismaService) { }

    // Matching backend-v2 routes/buyers.ts GET / (lines 9-35)
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

        const buyers = await this.prisma.buyer.findMany({
            where,
            orderBy: { [validSortBy]: validDir },
        });
        return buyers;
    }

    // Matching backend-v2 routes/buyers.ts POST / (lines 37-60)
    async create(dto: any) {
        const buyer = await this.prisma.buyer.create({
            data: {
                name: dto.name,
                email: dto.email,
                phone: dto.phone,
                gstin: dto.gstin?.trim() || null,
                addressLine1: dto.addressLine1 || '',
                addressLine2: dto.addressLine2,
                area: dto.area || '',
                city: dto.city || '',
                state: dto.state || '',
                country: dto.country || '',
                postalCode: dto.postalCode || '',
            },
        });
        return buyer;
    }

    // Matching backend-v2 routes/buyers.ts PUT /:id (lines 62-78)
    async update(id: number, dto: any) {
        const { gstin, ...restData } = dto;
        const buyer = await this.prisma.buyer.update({
            where: { id },
            data: {
                ...restData,
                gstin: gstin?.trim() || null,
            },
        });
        return buyer;
    }

    // Matching backend-v2 routes/buyers.ts DELETE /:id (lines 80-93) - Soft delete
    async archive(id: number) {
        await this.prisma.buyer.update({
            where: { id },
            data: { isArchived: true },
        });
        return { ok: true };
    }

    // Matching backend-v2 routes/buyers.ts PATCH /:id/restore (lines 95-108)
    async restore(id: number) {
        const buyer = await this.prisma.buyer.update({
            where: { id },
            data: { isArchived: false },
        });
        return buyer;
    }

    // Matching backend-v2 routes/buyers.ts DELETE /:id/permanent (lines 110-127)
    async permanentDelete(id: number) {
        const invoiceCount = await this.prisma.invoice.count({ where: { buyerId: id } });
        if (invoiceCount > 0) {
            throw new ConflictException('Cannot delete buyer while related invoices exist. Remove/reassign them first.');
        }
        await this.prisma.buyer.delete({ where: { id } });
        return { ok: true };
    }
}
