import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Resetting and seeding database...');

  // Clean tables in correct FK order
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.project.deleteMany();
  await prisma.product.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();

  // ✅ Roles
  const superAdmin = await prisma.role.create({ data: { name: 'SuperAdmin' } });
  const admin = await prisma.role.create({ data: { name: 'Admin' } });
  const employee = await prisma.role.create({ data: { name: 'Employee' } });

  // ✅ Permissions
  const PERM_KEYS = [
    ['users.create', 'Users Create'], ['users.read', 'Users Read'], ['users.update', 'Users Update'], ['users.delete', 'Users Delete'],
    ['roles.create', 'Roles Create'], ['roles.read', 'Roles Read'], ['roles.update', 'Roles Update'], ['roles.delete', 'Roles Delete'],
    ['permissions.read', 'Permissions Read'], ['permissions.update', 'Permissions Update'],
    ['product.create', 'Product Create'], ['product.read', 'Product Read'], ['product.update', 'Product Update'], ['product.delete', 'Product Delete'],
    ['invoice.create', 'Invoice Create'], ['invoice.read', 'Invoice Read'], ['invoice.update', 'Invoice Update'], ['invoice.delete', 'Invoice Delete'],
    ['extra.product.price.edit', 'Extra Product Price Edit'], ['extra.view', 'Extra View'], ['extra.all', 'Extra All']
  ];

  // ✅ Map out role-based permissions clearly
  const superAdminPerms = PERM_KEYS.map(([key, name]) => ({
    key,
    name,
    roleId: superAdmin.id,
  }));

  const adminKeys = [
    'roles.read','permissions.read','users.read','product.read','invoice.read',
    'extra.view','extra.product.price.edit','users.create','users.update',
    'product.create','product.update','invoice.create','invoice.update'
  ];

  const employeeKeys = ['users.read','product.read','invoice.read'];

  const adminPerms = PERM_KEYS.filter(([key]) => adminKeys.includes(key))
    .map(([key, name]) => ({ key, name, roleId: admin.id }));

  const employeePerms = PERM_KEYS.filter(([key]) => employeeKeys.includes(key))
    .map(([key, name]) => ({ key, name, roleId: employee.id }));

  // ✅ Merge all (ensuring roleId always defined)
  const allPerms = [...superAdminPerms, ...adminPerms, ...employeePerms];
  await prisma.permission.createMany({ data: allPerms, skipDuplicates: true });

  // ✅ Users
  const hash = (pwd) => bcrypt.hashSync(pwd, 10);
  await prisma.user.createMany({
    data: [
      { email: 'superadmin@ems.com', password: hash('Super@123'), roleId: superAdmin.id, firstName: 'Super', lastName: 'Admin', mustChangePassword: false },
      { email: 'admin@ems.com', password: hash('Admin@123'), roleId: admin.id, firstName: 'Admin', lastName: 'User', mustChangePassword: false },
      { email: 'employee@ems.com', password: hash('Emp@123'), roleId: employee.id, firstName: 'Employee', lastName: 'User', mustChangePassword: false },
    ],
  });

  // ✅ Suppliers
  const s1 = await prisma.supplier.create({
    data: { name: 'Blue Supply Co', email: 'blue@supply.com', phone: '1234567890', address: '32 Market St' },
  });
  const s2 = await prisma.supplier.create({
    data: { name: 'Nova Goods', email: 'contact@novagoods.com', phone: '5551234567', address: '45 Industrial Rd' },
  });

  // ✅ Buyers
  const b1 = await prisma.buyer.create({ data: { name: 'Alice Retail', email: 'alice@retail.com' } });
  const b2 = await prisma.buyer.create({ data: { name: 'Beta Stores', email: 'beta@stores.com' } });

  // ✅ Products
  const p1 = await prisma.product.create({
    data: {
      sku: 'SKU-2001',
      title: 'Wireless Mouse',
      description: 'Ergonomic low-latency mouse',
      category: 'Electronics',
      price: 1999,
      stock: 120,
      supplierId: s1.id,
      buyerId: b1.id,
    },
  });
  const p2 = await prisma.product.create({
    data: {
      sku: 'SKU-2002',
      title: 'Mechanical Keyboard',
      description: 'Hot-swappable blue switches',
      category: 'Electronics',
      price: 5999,
      stock: 60,
      supplierId: s1.id,
      buyerId: b2.id,
    },
  });

  // ✅ Projects
  const proj1 = await prisma.project.create({
    data: {
      title: 'Website Redesign',
      description: 'Refresh landing pages and convert to Tailwind',
      category: 'UI/UX',
      price: 150000,
      supplierId: s1.id,
      buyerId: b1.id,
      productId: p1.id,
      status: 'Pending',
    },
  });
  const proj2 = await prisma.project.create({
    data: {
      title: 'Mobile App MVP',
      description: 'Build MVP for beta release',
      category: 'Development',
      price: 275000,
      supplierId: s2.id,
      buyerId: b2.id,
      productId: null,
      status: 'Processing',
    },
  });

  // ✅ Invoices
  await prisma.invoice.create({
    data: {
      invoiceNo: 'INV-1001',
      buyerId: b1.id,
      supplierId: s1.id,
      paymentMethod: 'Cash',
      total: 150000,
      status: 'Draft',
      projectId: proj1.id,
      items: {
        create: [
          {
            title: 'Website Redesign',
            description: 'Landing pages',
            qty: 1,
            price: 150000,
            gst: 0,
            amount: 150000,
            productId: p1.id,
          },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      invoiceNo: 'INV-1002',
      buyerId: b2.id,
      supplierId: s2.id,
      paymentMethod: 'UPI',
      total: 5999,
      status: 'Draft',
      items: {
        create: [
          {
            title: 'Mechanical Keyboard',
            description: 'Blue switches',
            qty: 1,
            price: 5999,
            gst: 0,
            amount: 5999,
            productId: p2.id,
          },
        ],
      },
    },
  });

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((err) => {
    console.error('❌ Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
