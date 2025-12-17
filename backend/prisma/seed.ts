// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database (TS)...')

  await prisma.invoiceItem.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.product.deleteMany()
  await prisma.buyer.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.rolePermission.deleteMany()
  await prisma.user.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.role.deleteMany()

  const superAdmin = await prisma.role.create({ data: { name: 'SuperAdmin' } })
  const admin = await prisma.role.create({ data: { name: 'Admin' } })
  const employee = await prisma.role.create({ data: { name: 'Employee' } })

  const KEYS = [
    'user.create', 'user.read', 'user.update', 'user.delete',
    'role.create', 'role.read', 'role.update', 'role.delete',
    'permission.create', 'permission.read', 'permission.update', 'permission.delete', 'permission.permission',
    'product.create', 'product.read', 'product.update', 'product.delete',
    'invoice.create', 'invoice.read', 'invoice.update', 'invoice.delete',
    'buyer.create', 'buyer.read', 'buyer.update', 'buyer.delete',
    'order.create', 'order.read'
  ]

  const permissions = await Promise.all(
    KEYS.map(key => prisma.permission.create({ data: { key, name: key } }))
  )

  // RolePermissions
  const allPerms = permissions.map(p => p.id)
  const adminPerms = permissions
    .filter(p => !p.key.endsWith('.delete') && !p.key.startsWith('permission.'))
    .map(p => p.id)
  const employeePerms = permissions.filter(p => p.key.endsWith('.read')).map(p => p.id)

  await Promise.all([
    ...allPerms.map(pid => prisma.rolePermission.create({ data: { roleId: superAdmin.id, permissionId: pid, enabled: true } })),
    ...adminPerms.map(pid => prisma.rolePermission.create({ data: { roleId: admin.id, permissionId: pid, enabled: true } })),
    ...employeePerms.map(pid => prisma.rolePermission.create({ data: { roleId: employee.id, permissionId: pid, enabled: true } })),
  ])

  const hash = (pwd: string) => bcrypt.hashSync(pwd, 10)
  await prisma.user.createMany({
    data: [
      { email: 'superadmin@ems.com', password: hash('Super@123'), roleId: superAdmin.id, firstName: 'Super', lastName: 'Admin', mustChangePassword: false },
      { email: 'admin@ems.com', password: hash('Admin@123'), roleId: admin.id, firstName: 'Admin', lastName: 'User', mustChangePassword: false },
      { email: 'employee@ems.com', password: hash('Emp@123'), roleId: employee.id, firstName: 'Employee', lastName: 'User', mustChangePassword: false },
    ],
  })

  const suppliers = await Promise.all(
    Array.from({ length: 5 }).map((_, i) =>
      prisma.supplier.create({
        data: {
          name: `Supplier ${i + 1}`,
          email: `supplier${i + 1}@mail.com`,
          phone: `90000${String(i + 1).padStart(5, '0')}`,
          addressLine1: `${i + 1} Market Street`,
        },
      })
    )
  )

  const buyers = await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      prisma.buyer.create({
        data: {
          name: `Buyer ${i + 1}`,
          email: `buyer${i + 1}@mail.com`,
          phone: `80000${String(i + 1).padStart(5, '0')}`,
          addressLine1: `${i + 1} Industrial Ave`,
        },
      })
    )
  )

  const productTitles = [
    'Industrial Milk Pump', 'Cream Separator', 'Butter Churner',
    'Milk Pasteurizer', 'Homogenizer', 'Cheese Press',
    'Yogurt Incubator', 'Sterilization Unit', 'Cooling Tank', 'CIP System',
  ]

  const products = await Promise.all(
    productTitles.map((title, i) => {
      const supplier = suppliers[i % suppliers.length]
      return prisma.product.create({
        data: {
          sku: `SKU-${3000 + i + 1}`,
          title,
          description: `${title} for dairy operations`,
          category: 'Dairy Equipment',
          price: Math.round(1000 + Math.random() * 14000),
          stock: 10 + ((i + 1) % 10),
          supplierId: supplier.id,
        },
      })
    })
  )

  interface CreateInvoiceArgs {
    invoiceNo: string;
    buyer: typeof buyers[0];
    productIdxs: number[];
    status: 'Draft' | 'Pending' | 'Paid' | 'Overdue' | 'Cancelled' | 'Completed';
  }

  async function createInvoice({ invoiceNo, buyer, productIdxs, status }: CreateInvoiceArgs) {
    const items = productIdxs.map(idx => {
      const p = products[idx]
      const qty = 1 + (idx % 2)
      const gst = 12
      const amount = p.price * qty * (1 + gst / 100)
      return {
        productId: p.id,
        title: p.title,
        description: 'Auto-generated line',
        qty,
        price: p.price,
        gst,
        discountPct: 0,
        amount,
      }
    })
    const total = items.reduce((sum, it) => sum + it.amount, 0)

    const supplierId = products[productIdxs[0]].supplierId;
    if (!supplierId) throw new Error('Product has no supplier');

    return prisma.invoice.create({
      data: {
        invoiceNo,
        buyerId: buyer.id,
        supplierId,
        paymentMethod: 'Cash',
        total,
        status,
        items: { create: items },
      },
    })
  }

  await Promise.all([
    createInvoice({ invoiceNo: 'INV-2001', buyer: buyers[0], productIdxs: [0, 1], status: 'Completed' }),
    createInvoice({ invoiceNo: 'INV-2002', buyer: buyers[1], productIdxs: [2], status: 'Completed' }),
    createInvoice({ invoiceNo: 'INV-2003', buyer: buyers[2], productIdxs: [3], status: 'Draft' }),
  ])

  console.log('✅ Seed (TS) completed successfully!')
}

main()
  .catch(err => {
    console.error('❌ Seed error:', err)
    throw err
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

