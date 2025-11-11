import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { prisma } from '../prisma.js';
import { authenticate } from '../middleware/auth.js';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!user || user.isArchived) return res.status(401).json({ message: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, role: user.role.name }, JWT_SECRET, { expiresIn: '8h' });
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
    }
  });
});

router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) return res.status(400).json({ message: 'Current password incorrect' });
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hash, mustChangePassword: false } });
  return res.json({ message: 'Password updated' });
});

// Bootstrap endpoint to get current user and permissions
router.get('/me', authenticate, async (req, res) => {
  const dbUser = await prisma.user.findUnique({ where: { id: req.user.id }, include: { role: true } });
  if (!dbUser) return res.status(404).json({ message: 'User not found' });
  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId: dbUser.roleId, enabled: true },
    include: { permission: true }
  });
  return res.json({
    id: dbUser.id,
    roleId: dbUser.roleId,
    email: dbUser.email,
    role: dbUser.role.name,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    mustChangePassword: dbUser.mustChangePassword,
    permissions: rolePerms.map(rp => rp.permission.key)
  });
});

export default router;
