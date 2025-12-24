import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
    constructor(private prisma: PrismaService) { }

    // Matching backend-v2 routes/roles.ts GET / (lines 9-12)
    async findAll() {
        const roles = await this.prisma.role.findMany({
            include: {
                rolePermissions: {
                    where: { enabled: true },
                    include: { permission: true },
                },
            },
        });
        return roles;
    }

    // Matching backend-v2 routes/roles.ts GET /:id (lines 14-23)
    async findOne(id: number) {
        const role = await this.prisma.role.findUnique({ where: { id } });
        if (!role) throw new NotFoundException('Role not found');

        const permissions: Record<string, boolean> = {};
        const rolePerms = await this.prisma.rolePermission.findMany({
            where: { roleId: id, enabled: true },
            include: { permission: true },
        });
        for (const rp of rolePerms) permissions[rp.permission.key] = true;

        return { id: role.id, name: role.name, permissions };
    }

    // Matching backend-v2 routes/roles.ts POST / (lines 25-30)
    async create(name: string, description: string | undefined, actingRole: string) {
        if (actingRole !== 'SuperAdmin') throw new ForbiddenException('Forbidden');
        const role = await this.prisma.role.create({
            data: {
                name,
                ...(description ? { description } : {}),
            },
        });
        return role;
    }

    // Matching backend-v2 routes/roles.ts PUT /:id (lines 32-38)
    async update(id: number, name: string, description: string | undefined, actingRole: string) {
        if (actingRole !== 'SuperAdmin') throw new ForbiddenException('Forbidden');
        const role = await this.prisma.role.update({
            where: { id },
            data: {
                name,
                ...(description !== undefined ? { description } : {}),
            },
        });
        return role;
    }

    // Matching backend-v2 routes/roles.ts DELETE /:id (lines 40-45)
    async remove(id: number, actingRole: string) {
        if (actingRole !== 'SuperAdmin') throw new ForbiddenException('Forbidden');
        await this.prisma.role.delete({ where: { id } });
        return { ok: true };
    }

    // Matching backend-v2 routes/roles.ts GET /:id/permissions (lines 47-52)
    async getPermissions(id: number) {
        const items = await this.prisma.rolePermission.findMany({
            where: { roleId: id, enabled: true },
            include: { permission: true },
        });
        return items.map((i) => i.permission.key);
    }

    // Matching backend-v2 routes/roles.ts PUT /:id/permissions (lines 54-86)
    async updatePermission(id: number, key: string, enabled: boolean, actingRole: string) {
        if (typeof key !== 'string' || typeof enabled !== 'boolean') {
            throw new BadRequestException('Provide { key, enabled }');
        }

        const targetRole = await this.prisma.role.findUnique({ where: { id } });
        if (!targetRole) throw new NotFoundException('Role not found');

        // Permission hierarchy checks (matching backend-v2 lines 65-69)
        if (actingRole === targetRole.name) {
            throw new ForbiddenException('Cannot edit own role permissions');
        }
        if (actingRole === 'Employee') {
            throw new ForbiddenException('Forbidden');
        }
        if (actingRole === 'Admin' && targetRole.name !== 'Employee') {
            throw new ForbiddenException('Admins can edit only Employee permissions');
        }
        if (actingRole === 'SuperAdmin' && targetRole.name === 'SuperAdmin' && enabled === false) {
            throw new ForbiddenException('Cannot remove SuperAdmin permissions');
        }

        const perm = await this.prisma.permission.upsert({
            where: { key },
            update: { name: key },
            create: { key, name: key },
        });

        await this.prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: id, permissionId: perm.id } },
            update: { enabled },
            create: { roleId: id, permissionId: perm.id, enabled },
        });

        const updated = await this.prisma.rolePermission.findMany({
            where: { roleId: id },
            include: { permission: true },
        });

        // Match backend-v2 routes/roles.ts PUT /:id/permissions response exactly:
        // Express returns a plain string[] of enabled permission keys.
        const updatedKeys = updated
            .filter((u) => u.enabled)
            .map((u) => u.permission.key);

        return updatedKeys;
    }
}
