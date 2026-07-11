import { createClient, Client } from '@libsql/client'

const globalForDb = globalThis as unknown as {
  libsql: Client | undefined
}

export function getClient(): Client {
  if (!globalForDb.libsql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    globalForDb.libsql = createClient({ url })
  }
  return globalForDb.libsql
}

export async function ensureTables() {
  const client = getClient()
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
    await client.execute(`CREATE TABLE IF NOT EXISTS "Product" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT, "duration" TEXT NOT NULL, "credits" INTEGER NOT NULL, "categoryId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
    await client.execute(`CREATE TABLE IF NOT EXISTS "Key" ("id" TEXT NOT NULL PRIMARY KEY, "code" TEXT NOT NULL, "productId" TEXT NOT NULL, "isSold" BOOLEAN NOT NULL DEFAULT 0, "soldAt" DATETIME, "soldTo" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Key_code_key" UNIQUE ("code"))`)
    await client.execute(`CREATE TABLE IF NOT EXISTS "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "keyId" TEXT NOT NULL, "productName" TEXT NOT NULL, "credits" INTEGER NOT NULL, "buyerInfo" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "userId" TEXT)`)
    await client.execute(`CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY, "username" TEXT NOT NULL, "password" TEXT NOT NULL, "displayName" TEXT NOT NULL, "credits" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "User_username_key" UNIQUE ("username"))`)
    await client.execute(`CREATE TABLE IF NOT EXISTS "Tutorial" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "url" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
    await client.execute(`CREATE TABLE IF NOT EXISTS "Link" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "url" TEXT NOT NULL, "description" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`)

    // Migrations: add missing columns to existing tables
    try {
      const cols = await client.execute(`PRAGMA table_info("Product")`)
      const colNames = cols.rows.map((r: any) => r.name)
      if (!colNames.includes('categoryId')) {
        await client.execute(`ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT`)
      }
    } catch (e) {
      // Migration failed, try again next call
      console.error('Migration error:', e)
    }
  } catch { /* ok */ }
}