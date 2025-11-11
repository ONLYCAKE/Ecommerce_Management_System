import { Router } from 'express'
import PDFDocument from 'pdfkit'
import { authenticate } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const router = Router()
router.use(authenticate)

router.get('/generate/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
  if (!['SuperAdmin', 'Admin', 'Employee'].includes(req.user.role))
    return res.status(403).json({ message: 'Forbidden' })

  const id = Number(req.params.id)
  const project = await prisma.project.findUnique({
    where: { id },
    include: { buyer: true, supplier: true },
  })
  if (!project) return res.status(404).json({ message: 'Project not found' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=invoice-${project.id}.pdf`
  )

  const doc = new PDFDocument({ margin: 50 })
  doc.pipe(res)

  // Header
  doc.fontSize(20).text('INVOICE', { align: 'right' })
  doc.moveDown()

  // Supplier & Buyer
  doc.fontSize(12).text('Supplier:', { underline: true })
  doc.text(project.supplier.name)
  if (project.supplier.email) doc.text(project.supplier.email)
  if (project.supplier.phone) doc.text(project.supplier.phone)
  if (project.supplier.address) doc.text(project.supplier.address)

  doc.moveDown()
  doc.text('Bill To:', { underline: true })
  doc.text(project.buyer.name)
  if (project.buyer.email) doc.text(project.buyer.email)
  if (project.buyer.phone) doc.text(project.buyer.phone)
  if (project.buyer.address) doc.text(project.buyer.address)

  doc.moveDown()
  // Project details
  doc.text(`Project #${project.id}`)
  doc.text(`Title: ${project.title}`)
  if (project.category) doc.text(`Category: ${project.category}`)
  if (project.description) doc.text(`Description: ${project.description}`)
  doc.text(`Status: ${project.status}`)

  doc.moveDown()
  doc.fontSize(14).text(`Total: ₹ ${project.price.toFixed(2)}`, { align: 'right' })

  doc.end()
})

export default router
