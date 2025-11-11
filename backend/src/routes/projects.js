import { Router } from 'express'
import { prisma } from '../prisma.js'
import { authenticate, roleCheck } from '../middleware/auth.js'
import { PERMISSIONS } from '../constants/permissions.js'

const router = Router()
router.use(authenticate)

// List projects
router.get('/', roleCheck(PERMISSIONS.ORDER_READ), async (req, res) => {
  const items = await prisma.project.findMany({
    include: { buyer: true, supplier: true },
    orderBy: { createdAt: 'desc' }
  })
  res.json(items)
})

// Get project
router.get('/:id', roleCheck(PERMISSIONS.ORDER_READ), async (req, res) => {
  const id = Number(req.params.id)
  const item = await prisma.project.findUnique({ where: { id }, include: { buyer: true, supplier: true } })
  if (!item) return res.status(404).json({ message: 'Not found' })
  res.json(item)
})

// Create project
router.post('/', roleCheck(PERMISSIONS.ORDER_CREATE), async (req, res) => {
  const { title, description, category, price, supplierId, buyerId, status } = req.body
  const project = await prisma.project.create({
    data: {
      title,
      description: description || null,
      category: category || null,
      price: Number(price),
      supplierId: Number(supplierId),
      buyerId: Number(buyerId),
      status: status || 'PENDING',
    }
  })
  res.status(201).json(project)
})

// Update project
router.put('/:id', roleCheck(PERMISSIONS.ORDER_CREATE), async (req, res) => {
  const id = Number(req.params.id)
  const { title, description, category, price, supplierId, buyerId, status } = req.body
  try {
    const updated = await prisma.project.update({
      where: { id },
      data: {
        title,
        description: description ?? null,
        category: category ?? null,
        price: price !== undefined ? Number(price) : undefined,
        supplierId: supplierId !== undefined ? Number(supplierId) : undefined,
        buyerId: buyerId !== undefined ? Number(buyerId) : undefined,
        status: status || undefined,
      }
    })
    res.json(updated)
  } catch (e) {
    res.status(404).json({ message: 'Not found' })
  }
})

// Delete project
router.delete('/:id', roleCheck(PERMISSIONS.ORDER_CREATE), async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.project.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    res.status(404).json({ message: 'Not found' })
  }
})

// Update status
router.patch('/:id/status', async (req, res) => {
  // Allow SuperAdmin, Admin, Employee
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
  if (!['SuperAdmin','Admin','Employee'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
  const id = Number(req.params.id)
  const { status } = req.body // expect 'PENDING' | 'PROCESSING' | 'COMPLETED'
  if (!['PENDING','PROCESSING','COMPLETED'].includes(status)) return res.status(400).json({ message: 'Invalid status' })
  try {
    const updated = await prisma.project.update({ where: { id }, data: { status } })
    res.json(updated)
  } catch (e) {
    res.status(404).json({ message: 'Not found' })
  }
})

export default router
