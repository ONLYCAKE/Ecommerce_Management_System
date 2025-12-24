import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { prisma } from '../prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { loginLimiter } from '../middleware/rateLimit';

dotenv.config();

// SECURITY: JWT_SECRET is validated at startup in auth.ts middleware
const JWT_SECRET = process.env.JWT_SECRET!;

const router = Router();

/* ------------------------------- LOGIN ------------------------------- */
router.post('/login', loginLimiter, async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password required' });

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || user.isArchived)
    return res.status(401).json({ message: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match)
    return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, role: user.role.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  return res.json({
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
  });
});

/* -------------------------- CHANGE PASSWORD -------------------------- */
router.post(
  '/change-password',
  authenticate as any,
  async (req: AuthRequest, res: Response) => {

    const { currentPassword, newPassword } = req.body;

    const dbUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!dbUser) return res.status(404).json({ message: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, dbUser.password);
    if (!ok)
      return res.status(400).json({ message: 'Current password incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: dbUser.id },
      data: { password: hash, mustChangePassword: false },
    });

    return res.json({ message: 'Password updated' });
  }
);

/* ---------------------------------- ME ---------------------------------- */
router.get('/me', authenticate as any, async (req: AuthRequest, res: Response) => {

  const dbUser = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { role: true },
  });

  if (!dbUser)
    return res.status(404).json({ message: 'User not found' });

  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId: dbUser.roleId, enabled: true },
    include: { permission: true },
  });

  const overrides = await prisma.userPermissionOverride.findMany({
    where: { userId: dbUser.id },
    include: { permission: true },
  });

  const base = new Set(rolePerms.map((rp) => rp.permission.key));
  const grants = overrides.filter((o) => o.mode === 'GRANT').map((o) => o.permission.key);
  const denies = overrides.filter((o) => o.mode === 'DENY').map((o) => o.permission.key);

  for (const k of grants) base.add(k);
  for (const k of denies) base.delete(k);

  return res.json({
    id: dbUser.id,
    roleId: dbUser.roleId,
    email: dbUser.email,
    role: dbUser.role.name,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    mustChangePassword: dbUser.mustChangePassword,
    permissions: Array.from(base),
  });
});

export default router;
