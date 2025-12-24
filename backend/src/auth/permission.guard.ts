import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from './permission.decorator';
import { AuthUserPayload } from './jwt.strategy';

// Matching backend-v2 middleware/auth.ts requirePermission (lines 108-128)
@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no permission required, allow access
        if (!requiredPermission) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user: AuthUserPayload = request.user;

        if (!user) {
            throw new ForbiddenException('Forbidden');
        }

        // SuperAdmin bypasses all permission checks (matching backend-v2 line 116-119)
        if (user.role === 'SuperAdmin') {
            return true;
        }

        // Check if user has required permission (matching backend-v2 line 121-123)
        if (!user.permissions.includes(requiredPermission)) {
            throw new ForbiddenException('Forbidden');
        }

        return true;
    }
}
