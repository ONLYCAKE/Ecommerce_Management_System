import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authenticate, roleCheck } from '../middleware/auth.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = Router();
router.use(authenticate);

// Get all roles with their permissions summary
router.get('/', roleCheck(PERMISSIONS.ROLE_READ), async (_, res) => {
  const roles = await prisma.role.findMany({
    include: {
      rolePermissions: {
        where: { enabled: true },
        include: { permission: true }
      }
    }
  });
  res.json(roles);
});

// Get a single role and its permissions as a boolean map
router.get('/:id', roleCheck(PERMISSIONS.ROLE_READ), async (req, res) => {
  const id = Number(req.params.id);
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return res.status(404).json({ message: 'Role not found' });

  const permissions = {};
  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId: id, enabled: true },
    include: { permission: true }
  });
  for (const rp of rolePerms) permissions[rp.permission.key] = true;
  res.json({ id: role.id, name: role.name, permissions });
});

// Create role (SuperAdmin only)
router.post('/', roleCheck(PERMISSIONS.ROLE_CREATE), async (req, res) => {
  if (req.user.role !== 'SuperAdmin')
    return res.status(403).json({ message: 'Forbidden' });

  const { name } = req.body;
  const role = await prisma.role.create({ data: { name } });
  res.status(201).json(role);
});

// Update role name (SuperAdmin only)
router.put('/:id', roleCheck(PERMISSIONS.ROLE_UPDATE), async (req, res) => {
  if (req.user.role !== 'SuperAdmin')
    return res.status(403).json({ message: 'Forbidden' });

  const id = Number(req.params.id);
  const { name } = req.body;
  const role = await prisma.role.update({ where: { id }, data: { name } });
  res.json(role);
});

// Delete role (SuperAdmin only)
router.delete('/:id', roleCheck(PERMISSIONS.ROLE_DELETE), async (req, res) => {
  if (req.user.role !== 'SuperAdmin')
    return res.status(403).json({ message: 'Forbidden' });

  const id = Number(req.params.id);
  await prisma.role.delete({ where: { id } });
  res.json({ ok: true });
});

// Get permissions for a specific role (array of keys)
router.get('/:id/permissions', roleCheck(PERMISSIONS.ROLE_READ), async (req, res) => {
  const id = Number(req.params.id);
  const items = await prisma.rolePermission.findMany({
    where: { roleId: id, enabled: true },
    include: { permission: true }
  });
  if (!items) return res.status(404).json({ message: 'Role not found' });
  res.json(items.map(i => i.permission.key));
});

// ✅ Toggle a single permission for a role safely
router.put('/:id/permissions', roleCheck(PERMISSIONS.ROLE_UPDATE), async (req, res) => {
  const id = Number(req.params.id);
  const { key, enabled } = req.body || {};

  if (typeof key !== 'string' || typeof enabled !== 'boolean') {
    return res
      .status(400)
      .json({ message: 'Provide { key, enabled }' });
  }

  // Validate target role
  const targetRole = await prisma.role.findUnique({ where: { id } });
  if (!targetRole) return res.status(404).json({ message: 'Role not found' });

  // Restrictions by acting user
  const acting = req.user?.role;
  if (acting === targetRole.name) {
    return res.status(403).json({ message: 'Cannot edit own role permissions' });
  }
  if (acting === 'Employee') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (acting === 'Admin' && targetRole.name !== 'Employee') {
    return res
      .status(403)
      .json({ message: 'Admins can edit only Employee permissions' });
  }
  if (acting === 'SuperAdmin' && targetRole.name === 'SuperAdmin' && enabled === false) {
    return res
      .status(403)
      .json({ message: 'Cannot remove SuperAdmin permissions' });
  }

  // Ensure Permission exists
  const perm = await prisma.permission.upsert({
    where: { key },
    update: { name: key },
    create: { key, name: key }
  });

  // Upsert RolePermission
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: id, permissionId: perm.id } },
    update: { enabled },
    create: { roleId: id, permissionId: perm.id, enabled }
  });

  // Return updated keys
  const updated = await prisma.rolePermission.findMany({
    where: { roleId: id },
    include: { permission: true }
  });
  const updatedKeys = updated.filter(u => u.enabled).map(u => u.permission.key);

  // Emit socket event for live updates
  try {
    const io = req.app.get('io');
    if (io)
      io.emit('permissions.updated', {
        roleId: id,
        updatedPermissions: updatedKeys
      });
  } catch (e) {
    console.error('Socket emit error', e);
  }

  res.json(updatedKeys);
});

export default router;
