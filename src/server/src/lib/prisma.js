// Shared Prisma client instance to prevent connection pool exhaustion
import { PrismaClient } from '@prisma/client'

// Use a global variable in development to prevent multiple instances during hot reload
const globalForPrisma = globalThis

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
