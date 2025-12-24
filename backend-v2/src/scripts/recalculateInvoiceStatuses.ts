import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script to recalculate and update all invoice statuses
 * Run this once to fix existing invoices
 */
async function recalculateAllInvoiceStatuses() {
    try {
        console.log('🔄 Starting invoice status recalculation...');

        // Get all invoices (excluding cancelled)
        const invoices = await prisma.invoice.findMany({
            where: {
                status: {
                    not: 'Cancelled'
                }
            },
            include: {
                payments: true
            }
        });

        console.log(`📊 Found ${invoices.length} invoices to process`);

        let updated = 0;
        let unchanged = 0;

        for (const invoice of invoices) {
            // Calculate received amount
            const receivedAmount = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
            const balance = Math.round((invoice.total - receivedAmount) * 100) / 100;

            // Determine correct status
            let correctStatus = 'Unpaid';
            if (receivedAmount === 0) {
                correctStatus = 'Unpaid';
            } else if (balance > 0.01) {
                correctStatus = 'Partial';
            } else {
                correctStatus = 'Paid';
            }

            // Update if status or balance is incorrect
            if (invoice.status !== correctStatus || Math.abs(invoice.balance - balance) > 0.01) {
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: {
                        status: correctStatus,
                        balance: balance
                    }
                });

                console.log(`✅ Updated ${invoice.invoiceNo}: ${invoice.status} → ${correctStatus}, Balance: ₹${balance.toFixed(2)}`);
                updated++;
            } else {
                unchanged++;
            }
        }

        console.log('\n📈 Summary:');
        console.log(`   Total processed: ${invoices.length}`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Unchanged: ${unchanged}`);
        console.log('\n✅ Invoice status recalculation complete!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
recalculateAllInvoiceStatuses();
