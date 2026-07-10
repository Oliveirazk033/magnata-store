import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export async function ensureTables() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return
  try {
    const libsql = createClient({ url: dbUrl })
    await libsql.execute(`CREATE TABLE IF NOT EXISTS "Product" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT, "duration" TEXT NOT NULL, "credits" INTEGER NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
    await libsql.execute(`CREATE TABLE IF NOT EXISTS "Key" ("id" TEXT NOT NULL PRIMARY KEY, "code" TEXT NOT NULL, "productId" TEXT NOT NULL, "isSold" BOOLEAN NOT NULL DEFAULT 0, "soldAt" DATETIME, "soldTo" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Key_code_key" UNIQUE ("code"))`)
    await libsql.execute(`CREATE TABLE IF NOT EXISTS "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "keyId" TEXT NOT NULL, "productName" TEXT NOT NULL, "credits" INTEGER NOT NULL, "buyerInfo" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "userId" TEXT)`)
    await libsql.execute(`CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY, "username" TEXT NOT NULL, "password" TEXT NOT NULL, "displayName" TEXT NOT NULL, "credits" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "User_username_key" UNIQUE ("username"))`)
  } catch { /* tables may already exist */ }
}

function createDb(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL is not set')

  const libsql = createClient({ url: dbUrl })
  const adapter = new PrismaLibSQL(libsql)
  return new PrismaClient({ adapter })
}

let _db: PrismaClient | null = null

export function db() {
  if (!_db) {
    _db = globalForPrisma.prisma ?? createDb()
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _db
  }
  return _db
}