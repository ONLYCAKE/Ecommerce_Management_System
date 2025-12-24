import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';

@Controller('users')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Get()
    @RequirePermission('user.read')
    findAll(@Query() query: { q?: string; page?: number; pageSize?: number; archived?: string }) {
        return this.usersService.findAll(query);
    }

    @Get(':id')
    @RequirePermission('user.read')
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(Number(id));
    }

    @Post()
    @RequirePermission('user.create')
    create(@Body() body: any, @Request() req: { user: AuthUserPayload }) {
        return this.usersService.create(body, req.user.role);
    }

    @Put(':id')
    @RequirePermission('user.update')
    update(@Param('id') id: string, @Body() body: any, @Request() req: { user: AuthUserPayload }) {
        return this.usersService.update(Number(id), body, req.user.role);
    }

    @Delete(':id')
    @RequirePermission('user.delete')
    archive(@Param('id') id: string) {
        return this.usersService.archive(Number(id));
    }

    @Patch(':id/restore')
    @RequirePermission('user.update')
    restore(@Param('id') id: string) {
        return this.usersService.restore(Number(id));
    }

    // Permission Override Management (SuperAdmin only)
    @Get(':id/overrides')
    @RequirePermission('user.update')
    getPermissionOverrides(@Param('id') id: string, @Request() req: { user: AuthUserPayload }) {
        if (req.user.role !== 'SuperAdmin') {
            throw new ForbiddenException('Forbidden');
        }
        return this.usersService.getPermissionOverrides(Number(id));
    }

    @Put(':id/overrides')
    @RequirePermission('user.update')
    setPermissionOverrides(
        @Param('id') id: string,
        @Body() body: { overrides: Array<{ key: string; mode: 'GRANT' | 'DENY' }> },
        @Request() req: { user: AuthUserPayload }
    ) {
        if (req.user.role !== 'SuperAdmin') {
            throw new ForbiddenException('Forbidden');
        }
        return this.usersService.setPermissionOverrides(Number(id), body.overrides);
    }

    @Delete(':id/overrides/:permissionKey')
    @RequirePermission('user.update')
    deletePermissionOverride(
        @Param('id') id: string,
        @Param('permissionKey') permissionKey: string,
        @Request() req: { user: AuthUserPayload }
    ) {
        if (req.user.role !== 'SuperAdmin') {
            throw new ForbiddenException('Forbidden');
        }
        return this.usersService.deletePermissionOverride(Number(id), permissionKey);
    }
}

