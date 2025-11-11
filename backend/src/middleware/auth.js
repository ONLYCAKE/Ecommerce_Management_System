import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { prisma } from '../prisma.js';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, include: { role: true } });
    if (!user || user.isArchived) return res.status(401).json({ message: 'Unauthorized' });

    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleId: user.roleId, enabled: true },
      include: { permission: true }
    });
    const permissionKeys = rolePerms.map(rp => rp.permission.key);
    req.user = { id: user.id, email: user.email, roleId: user.roleId, role: user.role.name, permissions: permissionKeys };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const roleCheck = (permissionKey) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (req.user.role === 'SuperAdmin') return next();
  if (!permissionKey) return res.status(403).json({ message: 'Forbidden' });
  const allowed = Array.isArray(req.user.permissions) && req.user.permissions.includes(permissionKey);
  if (!allowed) return res.status(403).json({ message: 'Forbidden' });
  return next();
};

export const requirePermission = (key) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (req.user.role === 'SuperAdmin') return next();
  if (Array.isArray(req.user.permissions) && req.user.permissions.includes(key)) return next();
  return res.status(403).json({ message: 'Forbidden' });
};