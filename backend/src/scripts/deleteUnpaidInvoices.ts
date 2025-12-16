import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function listAndDeleteInvoices() {
    console.log('📊 Checking all invoices in database...\n');

    try {
        const invoices = await prisma.invoice.findMany({
            select: { id: true, invoiceNo: true, status: true, total: true }
        });

        console.log('All invoices:');
        invoices.forEach(inv => {
            console.log('  ' + inv.invoiceNo + ': ' + inv.status + ' - Rs' + inv.total);
        });

        console.log('\n📊 Total invoices: ' + invoices.length);

        // Find invoices that are NOT Paid (i.e., need to be deleted)
        const toDelete = invoices.filter(inv =>
            inv.status !== 'Paid' && inv.status !== 'Draft'
        );

        console.log('\n🗑️ Invoices to delete (not Paid/Draft): ' + toDelete.length);
        toDelete.forEach(inv => {
            console.log('  ' + inv.invoiceNo + ': ' + inv.status);
        });

        if (toDelete.length === 0) {
            console.log('\n✅ No invoices to delete');
            return;
        }

        console.log('\n🔄 Deleting...');
        for (const invoice of toDelete) {
            console.log('  Deleting ' + invoice.invoiceNo + '...');

            await prisma.$transaction(async (tx) => {
                // Delete payments first
                await tx.payment.deleteMany({
                    where: { invoiceId: invoice.id }
                });

                // Delete invoice items
                await tx.invoiceItem.deleteMany({
                    where: { invoiceId: invoice.id }
                });

                // Delete the invoice
                await tx.invoice.delete({
                    where: { id: invoice.id }
                });
            });

            console.log('    ✅ Deleted');
        }

        console.log('\n✅ Done! Deleted ' + toDelete.length + ' invoices');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

listAndDeleteInvoices();
