import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

// SECURITY: JWT_SECRET is validated at startup (matching backend-v2 auth.ts)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET environment variable is required');
    console.error('   Please set JWT_SECRET in your .env file');
    process.exit(1);
}

export interface AuthUserPayload {
    id: number;
    email: string;
    roleId: number;
    role: string;
    permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: JWT_SECRET,
        });
    }

    // Matching backend-v2 middleware/auth.ts lines 45-76
    async validate(payload: { id: number }): Promise<AuthUserPayload> {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.id },
            include: { role: true },
        });

        if (!user || user.isArchived) {
            throw new UnauthorizedException('Unauthorized');
        }

        const rolePerms = await this.prisma.rolePermission.findMany({
            where: { roleId: user.roleId, enabled: true },
            include: { permission: true },
        });

        const overrides = await (this.prisma as any).userPermissionOverride.findMany({
            where: { userId: user.id },
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
            id: user.id,
            email: user.email,
            roleId: user.roleId,
            role: user.role.name,
            permissions: Array.from(base),
        };
    }
}
