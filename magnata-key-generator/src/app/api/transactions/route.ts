import { NextRequest, NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

// GET /api/transactions — Listar vendas (admin)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const client = getClient();

    const result = await client.execute({
      sql: `
        SELECT t.*, k.code as "keyCode", k."isSold" as "keyIsSold", k."soldAt" as "keySoldAt",
               k."soldTo" as "keySoldTo", k."productId" as "keyProductId"
        FROM "Transaction" t
        LEFT JOIN "Key" k ON t."keyId" = k.id
        ORDER BY t."createdAt" DESC
        LIMIT 100
      `,
      args: [],
    });

    const transactions = result.rows.map((row) => ({
      id: row.id as string,
      keyId: row.keyId as string,
      productName: row.productName as string,
      credits: Number(row.credits),
      buyerInfo: row.buyerInfo as string,
      createdAt: String(row.createdAt),
      userId: row.userId as string | null,
      key: {
        id: row.keyId as string,
        code: row.keyCode as string,
        isSold: Boolean(Number(row.keyIsSold)),
        soldAt: row.keySoldAt ? String(row.keySoldAt) : null,
        soldTo: row.keySoldTo ? String(row.keySoldTo) : null,
        productId: row.keyProductId as string,
      },
    }));

    const totalCredits = transactions.reduce((sum, t) => sum + t.credits, 0);
    return NextResponse.json({ transactions, totalCredits, totalSales: transactions.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}