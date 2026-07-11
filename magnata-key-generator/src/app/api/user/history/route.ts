import { NextRequest, NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

// GET /api/user/history — List user's own transactions (keys generated)
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Faça login' }, { status: 401 });
  }

  try {
    await ensureTables();
    const client = getClient();

    const result = await client.execute({
      sql: `SELECT t.*, k.code as keyCode FROM "Transaction" t JOIN "Key" k ON t."keyId" = k.id WHERE t."userId" = ? ORDER BY t."createdAt" DESC`,
      args: [userId],
    });

    const transactions = result.rows.map((row) => ({
      id: row.id as string,
      keyCode: row.keyCode as string,
      productName: row.productName as string,
      credits: Number(row.credits),
      createdAt: String(row.createdAt),
    }));

    const totalKeys = transactions.length;
    const totalCreditsUsed = transactions.reduce((sum: number, t) => sum + t.credits, 0);

    return NextResponse.json({ transactions, totalKeys, totalCreditsUsed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}