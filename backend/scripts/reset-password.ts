import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

dotenv.config()
const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const emailArg = args.find(a => a.startsWith('--email='))
  const passArg = args.find(a => a.startsWith('--password='))
  if (!emailArg || !passArg) {
    console.error('Usage: npm run reset:password -- --email=user@example.com --password=NewPass123')
    process.exit(1)
  }
  const email = emailArg.split('=')[1]
  const newPassword = passArg.split('=')[1]

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error('User not found:', email)
    process.exit(1)
  }
  const hash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { email }, data: { password: hash, mustChangePassword: true } })
  console.log(`Password reset for ${email}. mustChangePassword=true on next login.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
