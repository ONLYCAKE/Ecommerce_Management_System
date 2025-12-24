import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    // Matching backend-v2 routes/products.ts GET / (lines 9-28)
    async findAll(query: { q?: string; archived?: string }) {
        const { q = '', archived = 'false' } = query;
        const isArchived = archived === 'true';

        const where: any = { isArchived };
        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
            ];
        }

        const items = await this.prisma.product.findMany({
            where,
            include: { supplier: true },
            orderBy: { createdAt: 'desc' },
        });
        return items;
    }

    // Matching backend-v2 routes/products.ts POST / (lines 30-56)
    async create(dto: any) {
        const supplierId = dto.supplierId && !isNaN(Number(dto.supplierId)) ? Number(dto.supplierId) : null;
        const price = Number(dto.price) || 0;
        const stock = Number(dto.stock) || 0;
        const taxType = dto.taxType || 'withTax';
        const taxRate = taxType === 'withTax' ? (Number(dto.taxRate) || 18) : 0;

        const item = await this.prisma.product.create({
            data: {
                sku: dto.sku || null,
                title: dto.title?.trim(),
                description: dto.description || null,
                category: dto.category || null,
                price,
                stock,
                supplierId,
                hsnCode: dto.hsnCode || null,
                taxType,
                taxRate,
            },
        });
        return item;
    }

    // Matching backend-v2 routes/products.ts PUT /:id (lines 58-84)
    async update(id: number, dto: any) {
        const supplierId = dto.supplierId === null || dto.supplierId === '' ? null : !isNaN(Number(dto.supplierId)) ? Number(dto.supplierId) : null;
        const price = dto.price !== undefined && !isNaN(Number(dto.price)) ? Number(dto.price) : undefined;
        const stock = dto.stock !== undefined && !isNaN(Number(dto.stock)) ? Number(dto.stock) : undefined;
        const taxType = dto.taxType || undefined;
        const taxRate = taxType === 'withTax' ? (dto.taxRate !== undefined ? Number(dto.taxRate) : undefined) : (taxType === 'withoutTax' ? 0 : undefined);

        const data: any = {
            title: dto.title?.trim(),
            description: dto.description || null,
            category: dto.category || null,
            ...(price !== undefined && { price }),
            ...(stock !== undefined && { stock }),
            supplierId,
            hsnCode: dto.hsnCode || null,
            ...(taxType !== undefined && { taxType }),
            ...(taxRate !== undefined && { taxRate }),
        };

        const item = await this.prisma.product.update({
            where: { id },
            data,
            include: { supplier: true },
        });
        return item;
    }

    // Matching backend-v2 routes/products.ts DELETE /:id (lines 86-99) - Soft delete
    async archive(id: number) {
        await this.prisma.product.update({
            where: { id },
            data: { isArchived: true },
        });
        return { ok: true };
    }

    // Matching backend-v2 routes/products.ts PATCH /:id/restore (lines 101-114)
    async restore(id: number) {
        const product = await this.prisma.product.update({
            where: { id },
            data: { isArchived: false },
        });
        return product;
    }

    // Matching backend-v2 routes/products.ts DELETE /:id/permanent (lines 116-127)
    async permanentDelete(id: number) {
        await this.prisma.invoiceItem.deleteMany({ where: { productId: id } });
        await this.prisma.product.delete({ where: { id } });
        return { ok: true };
    }
}
