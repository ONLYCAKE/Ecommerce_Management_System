import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import roleRoutes from './routes/roles.js';
import permissionRoutes from './routes/permissions.js';
import supplierRoutes from './routes/suppliers.js';
import buyerRoutes from './routes/buyers.js';
import productRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';
import invoicesRoutes from './routes/invoices.js';
import statsRoutes from './routes/stats.js';
import { prisma } from './prisma.js';
import { ADMIN_PERMISSIONS, EMPLOYEE_PERMISSIONS } from './constants/permissions.js';

dotenv.config();

const app = express();
// Relaxed CORS for dev: allow localhost ports (517x) and env override
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (origin === allowedOrigin) return callback(null, true)
    if (/^http:\/\/localhost:517\d$/.test(origin)) return callback(null, true)
    return callback(null, false)
  },
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.get('/health', (req, res) => res.json({ ok: true }));

// Mount all routes strictly under /api namespace
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

export default app;

// Fire-and-forget init to ensure Roles and base Permissions exist and SuperAdmin has all
(async () => {
  try {
    // Ensure base roles
    const [sa, admin, emp] = await Promise.all([
      prisma.role.upsert({ where: { name: 'SuperAdmin' }, update: {}, create: { name: 'SuperAdmin' } }),
      prisma.role.upsert({ where: { name: 'Admin' }, update: {}, create: { name: 'Admin' } }),
      prisma.role.upsert({ where: { name: 'Employee' }, update: {}, create: { name: 'Employee' } }),
    ]);

    // Base permissions
    const baseKeys = [
      // Users
      'user.read','user.create','user.update','user.delete',
      // Roles and permissions management
      'role.read','role.create','role.update','role.delete',
      'permission.read','permission.create','permission.update','permission.delete',
      'permission.permission',
      // Suppliers
      'supplier.read','supplier.create','supplier.update','supplier.delete',
      // Buyers
      'buyer.read','buyer.create','buyer.update','buyer.delete',
      // Products
      'product.read','product.create','product.update','product.delete',
      // Invoices
      'invoice.read','invoice.create','invoice.update','invoice.delete',
      // Orders
      'order.read','order.create'
    ];

    // Upsert all permissions and keep names in sync
    const perms = [];
    for (const key of baseKeys) {
      const perm = await prisma.permission.upsert({
        where: { key },
        update: { name: key },
        create: { key, name: key }
      });
      perms.push(perm);
    }

    // Ensure SuperAdmin has all permissions enabled
    for (const p of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: sa.id, permissionId: p.id } },
        update: { enabled: true },
        create: { roleId: sa.id, permissionId: p.id, enabled: true }
      });
    }

    // Assign baseline permissions for Admin
    for (const key of ADMIN_PERMISSIONS) {
      const p = await prisma.permission.findUnique({ where: { key } });
      if (p) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: admin.id, permissionId: p.id } },
          update: { enabled: true },
          create: { roleId: admin.id, permissionId: p.id, enabled: true }
        });
      }
    }

    // Assign baseline permissions for Employee
    for (const key of EMPLOYEE_PERMISSIONS) {
      const p = await prisma.permission.findUnique({ where: { key } });
      if (p) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: emp.id, permissionId: p.id } },
          update: { enabled: true },
          create: { roleId: emp.id, permissionId: p.id, enabled: true }
        });
      }
    }

    // Bootstrap demo users only if they don't exist
    const ensureUser = async ({ email, password, roleId, firstName, lastName }) => {
      const exists = await prisma.user.findUnique({ where: { email } });
      if (!exists) {
        const hash = await bcrypt.hash(password, 10);
        await prisma.user.create({
          data: { email, password: hash, roleId, firstName, lastName, mustChangePassword: false }
        });
      }
    };

    await Promise.all([
      ensureUser({ email: 'superadmin@ems.com', password: 'Super@123', roleId: sa.id, firstName: 'Super', lastName: 'Admin' }),
      ensureUser({ email: 'admin@ems.com', password: 'Admin@123', roleId: admin.id, firstName: 'Admin', lastName: 'User' }),
      ensureUser({ email: 'employee@ems.com', password: 'Emp@123', roleId: emp.id, firstName: 'Employee', lastName: 'User' }),
    ]);
  } catch (e) {
    console.error('Init permission seed failed:', e?.message || e);
  }
})();
