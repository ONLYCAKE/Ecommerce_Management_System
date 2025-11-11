import { Router } from 'express'
import { prisma } from '../prisma.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  try {
    const [products, buyers, suppliers, users] = await Promise.all([
      prisma.product.count(),
      prisma.buyer.count(),
      prisma.supplier.count(),
      prisma.user.count().catch(()=>0),
    ])

    const [draftCount, completedCount] = await Promise.all([
      prisma.invoice.count({ where: { status: 'Draft' } }).catch(()=>0),
      prisma.invoice.count({ where: { status: 'Completed' } }).catch(()=>0),
    ])

    const completed = await prisma.invoice.findMany({
      where: { status: 'Completed' },
      select: { id:true, total:true, createdAt:true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    // Revenue by month for last 12 months
    const now = new Date()
    const months = []
    for (let i=11;i>=0;i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      months.push({ key, year: d.getFullYear(), month: d.getMonth(), total: 0 })
    }
    const byKey = new Map(months.map(m=>[m.key, m]))
    for (const inv of completed) {
      const d = inv.createdAt
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      if (byKey.has(key)) byKey.get(key).total += Number(inv.total||0)
    }
    const revenueByMonth = months.map(m=> ({ label: m.key, total: m.total }))

    const recentOrders = await prisma.invoice.findMany({
      where: { status: 'Completed' },
      include: { buyer: true, supplier: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    const recentProducts = await prisma.product.findMany({
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    res.json({
      totals: { users, suppliers, buyers, products },
      invoices: { draft: draftCount, completed: completedCount },
      revenueByMonth,
      recentOrders,
      recentProducts,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to load stats' })
  }
})

export default router
