import { NextRequest, NextResponse } from 'next/server';
import { db, ensureTables } from '@/lib/db';

// GET /api/transactions — Listar vendas (admin)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const transactions = await db().transaction.findMany({
      include: { key: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const totalCredits = transactions.reduce((sum, t) => sum + t.credits, 0);
    return NextResponse.json({ transactions, totalCredits, totalSales: transactions.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}