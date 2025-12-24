// Quick script to unarchive SuperAdmin user
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function unarchiveSuperAdmin() {
    try {
        console.log('🔄 Unarchiving SuperAdmin user...')

        const result = await prisma.user.updateMany({
            where: {
                email: 'superadmin@ems.com',
                isArchived: true
            },
            data: {
                isArchived: false
            }
        })

        console.log(`✅ Updated ${result.count} user(s)`)

        // Verify the update
        const user = await prisma.user.findUnique({
            where: { email: 'superadmin@ems.com' },
            select: { email: true, isArchived: true, firstName: true, lastName: true }
        })

        console.log('📋 SuperAdmin status:', user)

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

unarchiveSuperAdmin()
