import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const userCount = await db.user.count()
    const tables = await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'") as { name: string }[]
    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      userCount,
      tables: tables.map(t => t.name),
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      tursoUrlPrefix: process.env.TURSO_DATABASE_URL?.substring(0, 30),
      adminDiscordId: process.env.ADMIN_DISCORD_ID,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      status: 'error',
      error: msg,
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      tursoUrlPrefix: process.env.TURSO_DATABASE_URL?.substring(0, 30),
    }, { status: 500 })
  }
}