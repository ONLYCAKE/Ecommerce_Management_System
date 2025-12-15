import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyInvoiceStatus() {
    try {
        console.log('Verifying invoice status...\n')

        // Get total count of invoices
        const totalInvoices = await prisma.invoice.count()
        console.log(`📊 Total invoices: ${totalInvoices}`)

        // Get count of paid invoices
        const paidInvoices = await prisma.invoice.count({
            where: { status: 'paid' }
        })
        console.log(`✅ Paid invoices: ${paidInvoices}`)

        // Get count of invoices with zero balance
        const zeroBalanceInvoices = await prisma.invoice.count({
            where: { balance: 0 }
        })
        console.log(`💰 Invoices with zero balance: ${zeroBalanceInvoices}`)

        // Get count of invoices that are both paid and have zero balance
        const fullyPaidInvoices = await prisma.invoice.count({
            where: {
                status: 'paid',
                balance: 0
            }
        })
        console.log(`🎯 Fully paid invoices (paid status + zero balance): ${fullyPaidInvoices}`)

        // Get sample of invoices to verify
        const sampleInvoices = await prisma.invoice.findMany({
            take: 5,
            select: {
                invoiceNo: true,
                status: true,
                balance: true,
                total: true
            }
        })

        console.log('\n📋 Sample invoices:')
        sampleInvoices.forEach(inv => {
            console.log(`  Invoice ${inv.invoiceNo}: Status=${inv.status}, Balance=${inv.balance}, Total=${inv.total}`)
        })

        if (totalInvoices === fullyPaidInvoices) {
            console.log('\n✅ SUCCESS: All invoices are marked as paid with zero balance!')
        } else {
            console.log('\n⚠️  WARNING: Some invoices may not be fully updated')
        }

    } catch (error) {
        console.error('❌ Error verifying invoices:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

// Run the verification
verifyInvoiceStatus()
    .then(() => {
        console.log('\nVerification completed')
        process.exit(0)
    })
    .catch((error) => {
        console.error('Verification failed:', error)
        process.exit(1)
    })
