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
import invoiceRoutes from './routes/invoice.js';
import ordersRoutes from './routes/orders.js';
import invoicesRoutes from './routes/invoices.js';
import statsRoutes from './routes/stats.js';
import { prisma } from './prisma.js';

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

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/roles', roleRoutes);
app.use('/permissions', permissionRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/buyers', buyerRoutes);
app.use('/products', productRoutes);

// New API namespace for PMS endpoints
app.use('/api/invoice', invoiceRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
// mirror core routes under /api for frontend baseURL compatibility
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/products', productRoutes);

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

    // Non-destructive: only use existing permissions; do NOT create to avoid
    // violating unknown DB constraints in production data.
    const perms = [];
    for (const key of baseKeys) {
      const existing = await prisma.permission.findUnique({ where: { key } });
      if (existing) {
        // keep name in sync if possible
        try { await prisma.permission.update({ where: { key }, data: { name: key } }); } catch {}
        perms.push(existing);
      }
    }

    // Ensure SuperAdmin has all permissions enabled
    for (const p of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: sa.id, permissionId: p.id } },
        update: { enabled: true },
        create: { roleId: sa.id, permissionId: p.id, enabled: true }
      });
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
