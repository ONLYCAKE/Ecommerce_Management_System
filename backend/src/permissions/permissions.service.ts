import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
    constructor(private prisma: PrismaService) { }

    // Matching backend-v2 routes/permission.ts GET / (lines 16-29)
    async findAll() {
        const items = await this.prisma.permission.findMany({
            orderBy: { id: 'asc' },
        });
        return items;
    }

    // Matching backend-v2 routes/permission.ts POST / (lines 36-56)
    async create(dto: { key: string; name: string; description?: string }, actingRole: string) {
        if (actingRole !== 'SuperAdmin') {
            throw new ForbiddenException('Forbidden');
        }

        const item = await this.prisma.permission.create({
            data: { key: dto.key, name: dto.name },
        });

        return item;
    }

    // Matching backend-v2 routes/permission.ts PUT /:id (lines 63-84)
    async update(id: number, dto: any, actingRole: string) {
        if (actingRole !== 'SuperAdmin') {
            throw new ForbiddenException('Forbidden');
        }

        const updated = await this.prisma.permission.update({
            where: { id },
            data: dto,
        });

        return updated;
    }

    // Matching backend-v2 routes/permission.ts DELETE /:id (lines 91-111)
    async remove(id: number, actingRole: string) {
        if (actingRole !== 'SuperAdmin') {
            throw new ForbiddenException('Forbidden');
        }

        await this.prisma.permission.delete({
            where: { id },
        });

        return { ok: true };
    }
}
