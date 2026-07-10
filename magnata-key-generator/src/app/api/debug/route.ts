import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// GET /api/debug — Verificar env vars
export async function GET() {
  const adminSecret = process.env.ADMIN_SECRET;
  const dbUrl = process.env.DATABASE_URL;

  return NextResponse.json({
    ADMIN_SECRET_SET: !!adminSecret,
    ADMIN_SECRET_LENGTH: adminSecret?.length || 0,
    ADMIN_SECRET_FIRST_2: adminSecret ? adminSecret.substring(0, 2) + '***' : 'NOT SET',
    DATABASE_URL_SET: !!dbUrl,
    DATABASE_URL_PREFIX: dbUrl ? dbUrl.substring(0, 30) + '...' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  });
}

// POST /api/debug — Criar todas as tabelas automaticamente
export async function POST() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL nao configurada' }, { status: 500 });
  }

  try {
    const libsql = createClient({ url: dbUrl });

    const tables = [
      `CREATE TABLE IF NOT EXISTS "Product" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "duration" TEXT NOT NULL,
        "credits" INTEGER NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS "Key" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "code" TEXT NOT NULL,
        "productId" TEXT NOT NULL,
        "isSold" BOOLEAN NOT NULL DEFAULT 0,
        "soldAt" DATETIME,
        "soldTo" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Key_code_key" UNIQUE ("code"),
        CONSTRAINT "Key_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS "Transaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "keyId" TEXT NOT NULL,
        "productName" TEXT NOT NULL,
        "credits" INTEGER NOT NULL,
        "buyerInfo" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" TEXT,
        CONSTRAINT "Transaction_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "Key" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "username" TEXT NOT NULL,
        "password" TEXT NOT NULL,
        "displayName" TEXT NOT NULL,
        "credits" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "User_username_key" UNIQUE ("username")
      )`,
    ];

    const results = [];
    for (const sql of tables) {
      try {
        await libsql.execute(sql);
        const tableName = sql.match(/CREATE TABLE IF NOT EXISTS "(\w+)"/)?.[1];
        results.push({ table: tableName, status: 'ok' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        const tableName = sql.match(/CREATE TABLE IF NOT EXISTS "(\w+)"/)?.[1];
        results.push({ table: tableName, status: 'error', error: msg });
      }
    }

    // Add userId column to Transaction if missing
    try {
      await libsql.execute(`SELECT "userId" FROM "Transaction" LIMIT 0`);
      results.push({ table: 'Transaction.userId', status: 'already exists' });
    } catch {
      try {
        await libsql.execute(`ALTER TABLE "Transaction" ADD COLUMN "userId" TEXT`);
        results.push({ table: 'Transaction.userId', status: 'added' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        results.push({ table: 'Transaction.userId', status: 'error', error: msg });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}