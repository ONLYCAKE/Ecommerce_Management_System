import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsService } from './permissions.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';

@Controller('permissions')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class PermissionsController {
    constructor(private permissionsService: PermissionsService) { }

    @Get()
    @RequirePermission('permission.read')
    findAll() {
        return this.permissionsService.findAll();
    }

    @Post()
    @RequirePermission('permission.create')
    create(@Body() body: { key: string; name: string; description?: string }, @Request() req: { user: AuthUserPayload }) {
        return this.permissionsService.create(body, req.user.role);
    }

    @Put(':id')
    @RequirePermission('permission.update')
    update(@Param('id') id: string, @Body() body: any, @Request() req: { user: AuthUserPayload }) {
        return this.permissionsService.update(Number(id), body, req.user.role);
    }

    @Delete(':id')
    @RequirePermission('permission.delete')
    remove(@Param('id') id: string, @Request() req: { user: AuthUserPayload }) {
        return this.permissionsService.remove(Number(id), req.user.role);
    }
}
