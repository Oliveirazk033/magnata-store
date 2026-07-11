import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const isTurso = tursoUrl?.startsWith('libsql://') || tursoUrl?.startsWith('https://')

  if (isTurso) {
    const adapter = new PrismaLibSQL({ url: tursoUrl })
    return new PrismaClient({ adapter, log: ['error'] })
  }

  return new PrismaClient({ log: ['error'] })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db