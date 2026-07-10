import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient, Client } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  libsql: Client | undefined
}

export async function ensureTables() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return
  try {
    const client = createClient({ url: dbUrl })
    await client.execute(`CREATE TABLE IF NOT EXISTS "Product" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT, "duration" TEXT NOT NULL, "credits" INTEGER NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
    await client.execute(`CREATE TABLE IF NOT EXISTS "Key" ("id" TEXT NOT NULL PRIMARY KEY, "code" TEXT NOT NULL, "productId" TEXT NOT NULL, "isSold" BOOLEAN NOT NULL DEFAULT 0, "soldAt" DATETIME, "soldTo" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Key_code_key" UNIQUE ("code"))`)
    await client.execute(`CREATE TABLE IF NOT EXISTS "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "keyId" TEXT NOT NULL, "productName" TEXT NOT NULL, "credits" INTEGER NOT NULL, "buyerInfo" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "userId" TEXT)`)
    await client.execute(`CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY, "username" TEXT NOT NULL, "password" TEXT NOT NULL, "displayName" TEXT NOT NULL, "credits" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "User_username_key" UNIQUE ("username"))`)
  } catch { /* tables may already exist */ }
}

let _db: PrismaClient | null = null

export function db(overrideUrl?: string) {
  if (!_db) {
    const dbUrl = overrideUrl || process.env.DATABASE_URL
    if (!dbUrl) throw new Error('DATABASE_URL is not set')

    const libsql = createClient({ url: dbUrl })
    const adapter = new PrismaLibSQL(libsql)
    _db = new PrismaClient({ adapter })
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _db
  }
  return _db
}