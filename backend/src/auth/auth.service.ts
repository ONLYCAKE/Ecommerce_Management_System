import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    // Matching backend-v2 routes/auth.ts login (lines 17-53)
    async login(email: string, password: string) {
        if (!email || !password) {
            throw new BadRequestException('Email and password required');
        }

        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { role: true },
        });

        if (!user || user.isArchived) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const token = this.jwtService.sign(
            { id: user.id, role: user.role.name },
            { expiresIn: '8h' }
        );

        return {
            token,
            user: {
                id: user.id,
                roleId: user.roleId,
                email: user.email,
                role: user.role.name,
                firstName: user.firstName,
                lastName: user.lastName,
                mustChangePassword: user.mustChangePassword,
            },
        };
    }

    // Matching backend-v2 routes/auth.ts change-password (lines 56-82)
    async changePassword(userId: number, currentPassword: string, newPassword: string) {
        const dbUser = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!dbUser) {
            throw new NotFoundException('User not found');
        }

        const ok = await bcrypt.compare(currentPassword, dbUser.password);
        if (!ok) {
            throw new BadRequestException('Current password incorrect');
        }

        const hash = await bcrypt.hash(newPassword, 10);

        await this.prisma.user.update({
            where: { id: dbUser.id },
            data: { password: hash, mustChangePassword: false },
        });

        return { message: 'Password updated' };
    }

    // Matching backend-v2 routes/auth.ts /me (lines 85-110)
    async getMe(userId: number) {
        const dbUser = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { role: true },
        });

        if (!dbUser) {
            throw new NotFoundException('User not found');
        }

        const rolePerms = await this.prisma.rolePermission.findMany({
            where: { roleId: dbUser.roleId, enabled: true },
            include: { permission: true },
        });

        const overrides = await (this.prisma as any).userPermissionOverride.findMany({
            where: { userId: dbUser.id },
            include: { Permission: true },
        });

        const base = new Set(rolePerms.map((rp) => rp.permission.key));
        const grants = overrides
            .filter((o) => o.mode === 'GRANT')
            .map((o) => o.Permission.key);
        const denies = overrides
            .filter((o) => o.mode === 'DENY')
            .map((o) => o.Permission.key);

        for (const k of grants) base.add(k);
        for (const k of denies) base.delete(k);

        return {
            id: dbUser.id,
            roleId: dbUser.roleId,
            email: dbUser.email,
            role: dbUser.role.name,
            firstName: dbUser.firstName,
            lastName: dbUser.lastName,
            mustChangePassword: dbUser.mustChangePassword,
            permissions: Array.from(base),
        };
    }
}
