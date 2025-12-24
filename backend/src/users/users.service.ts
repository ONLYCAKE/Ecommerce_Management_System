import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    // Matching backend-v2 routes/users.ts GET / (lines 11-39)
    async findAll(query: {
        q?: string;
        page?: number;
        pageSize?: number;
        archived?: string;
    }) {
        const { q = '', page = 1, pageSize = 10, archived = 'false' } = query;
        const skip = (Number(page) - 1) * Number(pageSize);

        const where: any = {
            isArchived: archived === 'true',
            ...(q && q.trim()
                ? {
                    OR: [
                        { email: { contains: q, mode: 'insensitive' } },
                        { firstName: { contains: q, mode: 'insensitive' } },
                        { lastName: { contains: q, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };

        const [items, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: Number(pageSize),
                include: { role: true },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where }),
        ]);

        return { items, total, page: Number(page), pageSize: Number(pageSize) };
    }

    // Matching backend-v2 routes/users.ts GET /:id (lines 41-51)
    async findOne(id: number) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { role: true },
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    // Matching backend-v2 routes/users.ts POST / (lines 53-90)
    async create(dto: any, actingUserRole: string) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) throw new BadRequestException('Email already in use');

        const hash = await bcrypt.hash(dto.password || Math.random().toString(36).slice(2), 10);

        const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
        if (role?.name === 'SuperAdmin' && actingUserRole !== 'SuperAdmin') {
            throw new ForbiddenException('You cannot assign SuperAdmin role');
        }

        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                password: hash,
                roleId: dto.roleId,
                firstName: dto.firstName,
                lastName: dto.lastName,
                mustChangePassword: true,
            },
        });

        return user;
    }

    // Matching backend-v2 routes/users.ts PUT /:id (lines 92-111)
    async update(id: number, dto: any, actingUserRole: string) {
        if (dto.roleId) {
            const newRole = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
            if (newRole?.name === 'SuperAdmin' && actingUserRole !== 'SuperAdmin') {
                throw new ForbiddenException('You cannot assign SuperAdmin role');
            }
        }

        const data: any = {};

        if (dto.email !== undefined) {
            data.email = dto.email;
        }
        if (dto.firstName !== undefined) {
            data.firstName = dto.firstName;
        }
        if (dto.lastName !== undefined) {
            data.lastName = dto.lastName;
        }

        if (dto.password) {
            data.password = await bcrypt.hash(dto.password, 10);
        }

        if (dto.roleId) {
            data.roleId = dto.roleId;
        }

        const user = await this.prisma.user.update({
            where: { id },
            data,
        });

        return user;
    }

    // Matching backend-v2 routes/users.ts DELETE /:id (lines 113-122)
    async archive(id: number) {
        const user = await this.prisma.user.update({
            where: { id },
            data: { isArchived: true },
        });
        return { message: 'User archived successfully', user };
    }

    // Matching backend-v2 routes/users.ts PATCH /:id/restore (lines 124-133)
    async restore(id: number) {
        const user = await this.prisma.user.update({
            where: { id },
            data: { isArchived: false },
        });
        return { message: 'User restored successfully', user };
    }

    // Matching backend-v2 routes/users.ts GET /:id/overrides (lines 139-161)
    async getPermissionOverrides(userId: number) {
        const overrides = await this.prisma.userPermissionOverride.findMany({
            where: { userId },
            include: { Permission: true },
        });

        return overrides.map((o: any) => ({
            key: o.Permission.key,
            mode: o.mode as 'GRANT' | 'DENY',
        }));
    }

    // Matching backend-v2 routes/users.ts PUT /:id/overrides (lines 163-198)
    async setPermissionOverrides(
        userId: number,
        overrides: Array<{ key: string; mode: 'GRANT' | 'DENY' }>,
    ) {
        if (!Array.isArray(overrides)) {
            throw new BadRequestException('Invalid overrides payload');
        }

        for (const o of overrides) {
            if (!o || typeof o.key !== 'string' || (o.mode !== 'GRANT' && o.mode !== 'DENY')) {
                continue;
            }

            const perm = await this.prisma.permission.findUnique({ where: { key: o.key } });
            if (!perm) continue;

            await this.prisma.userPermissionOverride.upsert({
                where: { userId_permissionId: { userId, permissionId: perm.id } },
                update: { mode: o.mode },
                create: { userId, permissionId: perm.id, mode: o.mode },
            });
        }

        return { ok: true };
    }

    // Matching backend-v2 routes/users.ts DELETE /:id/overrides/:permissionKey (new)
    async deletePermissionOverride(userId: number, permissionKey: string) {
        const permission = await this.prisma.permission.findUnique({ where: { key: permissionKey } });
        if (!permission) {
            throw new NotFoundException('Permission not found');
        }

        await this.prisma.userPermissionOverride.deleteMany({
            where: { userId, permissionId: permission.id },
        });

        return { ok: true };
    }
}

