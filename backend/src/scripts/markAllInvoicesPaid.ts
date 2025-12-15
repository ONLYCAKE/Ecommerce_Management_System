import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function markAllInvoicesAsPaid() {
    try {
        console.log('Starting to mark all invoices as paid...')

        // Update all invoices to set status as 'paid' and balance to 0
        const result = await prisma.invoice.updateMany({
            data: {
                status: 'paid',
                balance: 0
            }
        })

        console.log(`✅ Successfully updated ${result.count} invoices to paid status with zero balance`)

    } catch (error) {
        console.error('❌ Error updating invoices:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

// Run the script
markAllInvoicesAsPaid()
    .then(() => {
        console.log('Script completed successfully')
        process.exit(0)
    })
    .catch((error) => {
        console.error('Script failed:', error)
        process.exit(1)
    })
