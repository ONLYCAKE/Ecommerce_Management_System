import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.ts';
import { authenticate, roleCheck } from '../middleware/auth.ts';
import { PERMISSIONS } from '../constants/permissions.ts';

const router = Router();

router.use(authenticate);

router.get('/', roleCheck(PERMISSIONS.USER_READ), async (req, res) => {
  try {
    const { q = '', page = 1, pageSize = 10, archived = 'false' } = req.query as any;
    const skip = (Number(page) - 1) * Number(pageSize);

    const where: any = {
      isArchived: archived === 'true' ? true : false,
      ...(q && (q as string).trim()
        ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
          ],
        }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take: Number(pageSize), include: { role: true }, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);

    res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

router.get('/:id', roleCheck(PERMISSIONS.USER_READ), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('❌ Error fetching user by ID:', err);
    res.status(500).json({ message: 'Server error fetching user' });
  }
});

router.post('/', roleCheck(PERMISSIONS.USER_CREATE), async (req, res) => {
  try {
    const { email, password, roleId, firstName, lastName, addressLine1, addressLine2, area, city, state, country, postalCode } = req.body as any;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const hash = await bcrypt.hash(password || Math.random().toString(36).slice(2), 10);

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if ((role as any)?.name === 'SuperAdmin' && (req as any).user.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'You cannot assign SuperAdmin role' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hash,
        roleId,
        firstName,
        lastName,
        addressLine1: addressLine1 || '',
        addressLine2,
        area: area || '',
        city: city || '',
        state: state || '',
        country: country || '',
        postalCode: postalCode || '',
        mustChangePassword: true
      },
    });

    res.status(201).json(user);
  } catch (err) {
    console.error('❌ Error creating user:', err);
    res.status(500).json({ message: 'Server error creating user' });
  }
});

router.put('/:id', roleCheck(PERMISSIONS.USER_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { roleId, ...rest } = req.body as any;

    if (roleId) {
      const newRole = await prisma.role.findUnique({ where: { id: roleId } });
      if ((newRole as any)?.name === 'SuperAdmin' && (req as any).user.role !== 'SuperAdmin') {
        return res.status(403).json({ message: 'You cannot assign SuperAdmin role' });
      }
    }

    const user = await prisma.user.update({ where: { id }, data: { ...rest, ...(roleId ? { roleId } : {}) } });

    res.json(user);
  } catch (err) {
    console.error('❌ Error updating user:', err);
    res.status(500).json({ message: 'Server error updating user' });
  }
});

router.delete('/:id', roleCheck(PERMISSIONS.USER_DELETE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.update({ where: { id }, data: { isArchived: true } });
    res.json({ message: 'User archived successfully', user });
  } catch (err) {
    console.error('❌ Error archiving user:', err);
    res.status(500).json({ message: 'Server error archiving user' });
  }
});

router.patch('/:id/restore', roleCheck(PERMISSIONS.USER_UPDATE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.update({ where: { id }, data: { isArchived: false } });
    res.json({ message: 'User restored successfully', user });
  } catch (err) {
    console.error('❌ Error restoring user:', err);
    res.status(500).json({ message: 'Server error restoring user' });
  }
});

// ---------------------- User Permission Overrides (SuperAdmin only) ----------------------

router.get('/:id/overrides', roleCheck(PERMISSIONS.USER_READ), async (req, res) => {
  try {
    // Restrict to SuperAdmin only
    if ((req as any).user?.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const userId = Number(req.params.id);

    const overrides = await prisma.userPermissionOverride.findMany({
      where: { userId },
      include: { permission: true },
    });

    const result = overrides.map((o) => ({
      key: o.permission.key,
      mode: o.mode as 'GRANT' | 'DENY',
    }));

    res.json(result);
  } catch (err) {
    console.error('❌ Error fetching user overrides:', err);
    res.status(500).json({ message: 'Server error fetching user overrides' });
  }
});

router.put('/:id/overrides', roleCheck(PERMISSIONS.USER_UPDATE), async (req, res) => {
  try {
    if ((req as any).user?.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const userId = Number(req.params.id);
    const { overrides } = (req.body || {}) as {
      overrides?: { key: string; mode: 'GRANT' | 'DENY' }[];
    };

    if (!Array.isArray(overrides)) {
      return res.status(400).json({ message: 'Invalid overrides payload' });
    }

    for (const o of overrides) {
      if (!o || typeof o.key !== 'string' || (o.mode !== 'GRANT' && o.mode !== 'DENY')) {
        continue;
      }

      const perm = await prisma.permission.findUnique({ where: { key: o.key } });
      if (!perm) continue;

      await prisma.userPermissionOverride.upsert({
        where: { userId_permissionId: { userId, permissionId: perm.id } },
        update: { mode: o.mode },
        create: { userId, permissionId: perm.id, mode: o.mode },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error updating user overrides:', err);
    res.status(500).json({ message: 'Server error updating user overrides' });
  }
});

router.delete('/:id/overrides/:permissionKey', roleCheck(PERMISSIONS.USER_UPDATE), async (req, res) => {
  try {
    if ((req as any).user?.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const userId = Number(req.params.id);
    const { permissionKey } = req.params;

    const permission = await prisma.permission.findUnique({ where: { key: permissionKey } });
    if (!permission) {
      return res.status(404).json({ message: 'Permission not found' });
    }

    await prisma.userPermissionOverride.deleteMany({
      where: { userId, permissionId: permission.id },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error deleting user override:', err);
    res.status(500).json({ message: 'Server error deleting user override' });
  }
});

export default router;
