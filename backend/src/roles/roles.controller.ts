import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesService } from './roles.service';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';

@Controller('roles')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class RolesController {
    constructor(private rolesService: RolesService) { }

    @Get()
    @RequirePermission('role.read')
    findAll() {
        return this.rolesService.findAll();
    }

    @Get(':id')
    @RequirePermission('role.read')
    findOne(@Param('id') id: string) {
        return this.rolesService.findOne(Number(id));
    }

    @Post()
    @RequirePermission('role.create')
    create(
        @Body() body: { name: string; description?: string },
        @Request() req: { user: AuthUserPayload },
    ) {
        return this.rolesService.create(body.name, body.description, req.user.role);
    }

    @Put(':id')
    @RequirePermission('role.update')
    update(
        @Param('id') id: string,
        @Body() body: { name: string; description?: string },
        @Request() req: { user: AuthUserPayload },
    ) {
        return this.rolesService.update(Number(id), body.name, body.description, req.user.role);
    }

    @Delete(':id')
    @RequirePermission('role.delete')
    remove(@Param('id') id: string, @Request() req: { user: AuthUserPayload }) {
        return this.rolesService.remove(Number(id), req.user.role);
    }

    @Get(':id/permissions')
    @RequirePermission('role.read')
    getPermissions(@Param('id') id: string) {
        return this.rolesService.getPermissions(Number(id));
    }

    @Put(':id/permissions')
    @RequirePermission('role.update')
    updatePermission(
        @Param('id') id: string,
        @Body() body: { key: string; enabled: boolean },
        @Request() req: { user: AuthUserPayload }
    ) {
        return this.rolesService.updatePermission(Number(id), body.key, body.enabled, req.user.role);
    }
}
