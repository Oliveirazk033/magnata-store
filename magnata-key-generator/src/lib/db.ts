import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL is not set')

  const libsql = createClient({ url: dbUrl })
  const adapter = new PrismaLibSQL(libsql)
  return new PrismaClient({ adapter })
}

// Lazy initialization — only connects when first used, not during build
let _db: PrismaClient | null = null

export function getDb() {
  if (!_db) {
    _db = globalForPrisma.prisma ?? createDb()
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _db
  }
  return _db
}

// For backwards compatibility
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})