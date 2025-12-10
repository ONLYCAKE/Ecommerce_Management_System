import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

import authRoutes from './routes/auth.ts';
import userRoutes from './routes/users.ts';
import roleRoutes from './routes/roles.ts';
import permissionRoutes from "./routes/permission.ts";

import supplierRoutes from './routes/suppliers.ts';
import buyerRoutes from './routes/buyers.ts';
import productRoutes from './routes/products.ts';
import ordersRoutes from './routes/orders.ts';
import invoicesRoutes from './routes/invoices.ts';
import statsRoutes from './routes/stats.ts';

import { prisma } from './prisma.ts';
import { ADMIN_PERMISSIONS, EMPLOYEE_PERMISSIONS } from './constants/permissions.ts';

dotenv.config();

const app = express();

// -------------------- CORS --------------------
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin === allowedOrigin) return callback(null, true);
    if (/^http:\/\/localhost:517\d$/.test(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));

app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.get('/health', (_req, res) => res.json({ ok: true }));

// -------------------- ROUTES --------------------
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);

app.use('/api/suppliers', supplierRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/stats', statsRoutes);

// -------------------- GLOBAL ERROR HANDLER --------------------
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(err?.status || 500).json({ message: err?.message || 'Server error' });
  }
);

export default app;

// -------------------- INITIAL PERMISSION + ROLE SEED --------------------
(async () => {
  try {
    // Create base roles
    const [sa, admin, emp] = await Promise.all([
      prisma.role.upsert({
        where: { name: 'SuperAdmin' },
        update: {},
        create: { name: 'SuperAdmin' },
      }),
      prisma.role.upsert({
        where: { name: 'Admin' },
        update: {},
        create: { name: 'Admin' },
      }),
      prisma.role.upsert({
        where: { name: 'Employee' },
        update: {},
        create: { name: 'Employee' },
      }),
    ]);

    // Base permission keys
    const baseKeys = [
      // Users
      'user.read', 'user.create', 'user.update', 'user.delete',

      // Roles & permissions management
      'role.read', 'role.create', 'role.update', 'role.delete',
      'permission.read', 'permission.create', 'permission.update', 'permission.delete',

      // Suppliers
      'supplier.read', 'supplier.create', 'supplier.update', 'supplier.delete',

      // Buyers
      'buyer.read', 'buyer.create', 'buyer.update', 'buyer.delete',

      // Products
      'product.read', 'product.create', 'product.update', 'product.delete',

      // Invoices
      'invoice.read', 'invoice.create', 'invoice.update', 'invoice.delete',

      // Orders
      'order.read', 'order.create',
    ];

    const perms: Array<{ id: number }> = [];

    for (const key of baseKeys) {
      const perm = await prisma.permission.upsert({
        where: { key },
        update: { name: key },
        create: { key, name: key },
      });
      perms.push(perm);
    }

    // SuperAdmin gets everything
    for (const p of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: sa.id, permissionId: p.id } },
        update: { enabled: true },
        create: { roleId: sa.id, permissionId: p.id, enabled: true },
      });
    }

    // Admin base permissions
    for (const key of ADMIN_PERMISSIONS) {
      const p = await prisma.permission.findUnique({ where: { key } });
      if (p) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: admin.id, permissionId: p.id } },
          update: { enabled: true },
          create: { roleId: admin.id, permissionId: p.id, enabled: true },
        });
      }
    }

    // Employee base permissions
    for (const key of EMPLOYEE_PERMISSIONS) {
      const p = await prisma.permission.findUnique({ where: { key } });
      if (p) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: emp.id, permissionId: p.id } },
          update: { enabled: true },
          create: { roleId: emp.id, permissionId: p.id, enabled: true },
        });
      }
    }

    // Create default demo users
    const ensureUser = async ({
      email,
      password,
      roleId,
      firstName,
      lastName,
    }: {
      email: string;
      password: string;
      roleId: number;
      firstName: string;
      lastName: string;
    }) => {
      const exists = await prisma.user.findUnique({ where: { email } });
      if (!exists) {
        const hash = await bcrypt.hash(password, 10);
        await prisma.user.create({
          data: {
            email,
            password: hash,
            roleId,
            firstName,
            lastName,
            mustChangePassword: false,
          },
        });
      }
    };

    await Promise.all([
      ensureUser({
        email: 'superadmin@ems.com',
        password: 'Super@123',
        roleId: sa.id,
        firstName: 'Super',
        lastName: 'Admin',
      }),
      ensureUser({
        email: 'admin@ems.com',
        password: 'Admin@123',
        roleId: admin.id,
        firstName: 'Admin',
        lastName: 'User',
      }),
      ensureUser({
        email: 'employee@ems.com',
        password: 'Emp@123',
        roleId: emp.id,
        firstName: 'Employee',
        lastName: 'User',
      }),
    ]);
  } catch (e: any) {
    console.error('Init permission seed failed:', e?.message || e);
  }
})();
