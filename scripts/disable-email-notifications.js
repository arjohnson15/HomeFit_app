/**
 * Script to disable email notifications for all existing users
 * Run this on production: docker-compose exec app node scripts/disable-email-notifications.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Disabling email notifications for all existing users...')

  const result = await prisma.userSettings.updateMany({
    where: {
      notifyByEmail: true
    },
    data: {
      notifyByEmail: false
    }
  })

  console.log(`Updated ${result.count} user(s) - email notifications disabled`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
