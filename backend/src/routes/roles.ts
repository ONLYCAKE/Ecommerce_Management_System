import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { authenticate, roleCheck } from '../middleware/auth.ts';
import { PERMISSIONS } from '../constants/permissions.ts';

const router = Router();
router.use(authenticate);

router.get('/', roleCheck(PERMISSIONS.ROLE_READ), async (_req, res) => {
  const roles = await prisma.role.findMany({ include: { rolePermissions: { where: { enabled: true }, include: { permission: true } } } });
  res.json(roles);
});

router.get('/:id', roleCheck(PERMISSIONS.ROLE_READ), async (req, res) => {
  const id = Number(req.params.id);
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return res.status(404).json({ message: 'Role not found' });

  const permissions: Record<string, boolean> = {};
  const rolePerms = await prisma.rolePermission.findMany({ where: { roleId: id, enabled: true }, include: { permission: true } });
  for (const rp of rolePerms) permissions[rp.permission.key] = true;
  res.json({ id: role.id, name: role.name, permissions });
});

router.post('/', roleCheck(PERMISSIONS.ROLE_CREATE), async (req, res) => {
  if ((req as any).user.role !== 'SuperAdmin') return res.status(403).json({ message: 'Forbidden' });
  const { name } = req.body as any;
  const role = await prisma.role.create({ data: { name } });
  res.status(201).json(role);
});

router.put('/:id', roleCheck(PERMISSIONS.ROLE_UPDATE), async (req, res) => {
  if ((req as any).user.role !== 'SuperAdmin') return res.status(403).json({ message: 'Forbidden' });
  const id = Number(req.params.id);
  const { name } = req.body as any;
  const role = await prisma.role.update({ where: { id }, data: { name } });
  res.json(role);
});

router.delete('/:id', roleCheck(PERMISSIONS.ROLE_DELETE), async (req, res) => {
  if ((req as any).user.role !== 'SuperAdmin') return res.status(403).json({ message: 'Forbidden' });
  const id = Number(req.params.id);
  await prisma.role.delete({ where: { id } });
  res.json({ ok: true });
});

router.get('/:id/permissions', roleCheck(PERMISSIONS.ROLE_READ), async (req, res) => {
  const id = Number(req.params.id);
  const items = await prisma.rolePermission.findMany({ where: { roleId: id, enabled: true }, include: { permission: true } });
  if (!items) return res.status(404).json({ message: 'Role not found' });
  res.json(items.map(i => i.permission.key));
});

router.put('/:id/permissions', roleCheck(PERMISSIONS.ROLE_UPDATE), async (req, res) => {
  const id = Number(req.params.id);
  const { key, enabled } = (req.body || {}) as any;

  if (typeof key !== 'string' || typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'Provide { key, enabled }' });
  }

  const targetRole = await prisma.role.findUnique({ where: { id } });
  if (!targetRole) return res.status(404).json({ message: 'Role not found' });

  const acting = (req as any).user?.role;
  if (acting === targetRole.name) return res.status(403).json({ message: 'Cannot edit own role permissions' });
  if (acting === 'Employee') return res.status(403).json({ message: 'Forbidden' });
  if (acting === 'Admin' && targetRole.name !== 'Employee') return res.status(403).json({ message: 'Admins can edit only Employee permissions' });
  if (acting === 'SuperAdmin' && targetRole.name === 'SuperAdmin' && enabled === false) return res.status(403).json({ message: 'Cannot remove SuperAdmin permissions' });

  const perm = await prisma.permission.upsert({ where: { key }, update: { name: key }, create: { key, name: key } });

  await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: id, permissionId: perm.id } }, update: { enabled }, create: { roleId: id, permissionId: perm.id, enabled } });

  const updated = await prisma.rolePermission.findMany({ where: { roleId: id }, include: { permission: true } });
  const updatedKeys = updated.filter(u => u.enabled).map(u => u.permission.key);

  try {
    const io = (req.app as any).get('io');
    if (io) io.emit('permissions.updated', { roleId: id, updatedPermissions: updatedKeys });
  } catch (e) {
    console.error('Socket emit error', e);
  }

  res.json(updatedKeys);
});

export default router;
