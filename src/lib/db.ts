import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const isTurso = tursoUrl?.startsWith('libsql://') || tursoUrl?.startsWith('https://')

  if (isTurso) {
    // Prisma requires DATABASE_URL for schema validation even when using adapter
    // Set it to the Turso URL so Prisma doesn't fail on init
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
      process.env.DATABASE_URL = tursoUrl
    }
    const adapter = new PrismaLibSQL({ url: tursoUrl })
    return new PrismaClient({ adapter, log: ['error', 'query'] })
  }

  return new PrismaClient({ log: ['error'] })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db