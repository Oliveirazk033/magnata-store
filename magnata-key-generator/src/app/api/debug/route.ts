import { NextResponse } from 'next/server';

// GET /api/debug — Verificar se as env vars estão configuradas (temporário)
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
}// trigger rebuild
