import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthUserPayload } from './jwt.strategy';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    // Matching backend-v2 routes/auth.ts POST /login (line 17)
    // Rate limited (matching backend-v2 loginLimiter)
    @Post('login')
    @Throttle({ default: { ttl: 900000, limit: 5 } }) // 5 requests per 15 minutes
    async login(@Body() body: { email: string; password: string }) {
        return this.authService.login(body.email, body.password);
    }

    // Matching backend-v2 routes/auth.ts POST /change-password (line 56)
    @Post('change-password')
    @UseGuards(AuthGuard('jwt'))
    async changePassword(
        @Request() req: { user: AuthUserPayload },
        @Body() body: { currentPassword: string; newPassword: string }
    ) {
        return this.authService.changePassword(
            req.user.id,
            body.currentPassword,
            body.newPassword
        );
    }

    // Matching backend-v2 routes/auth.ts GET /me (line 85)
    @Get('me')
    @SkipThrottle()
    @UseGuards(AuthGuard('jwt'))
    async getMe(@Request() req: { user: AuthUserPayload }) {
        return this.authService.getMe(req.user.id);
    }
}
