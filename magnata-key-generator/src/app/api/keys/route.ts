import { NextRequest, NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

// GET /api/keys — Listar keys de um produto (admin)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  try {
    await ensureTables();
    const client = getClient();

    let sql = `
      SELECT k.*, p.name as "productName", p.description as "productDescription",
             p.duration as "productDuration", p.credits as "productCredits",
             p."isActive" as "productIsActive", p."createdAt" as "productCreatedAt"
      FROM "Key" k
      LEFT JOIN "Product" p ON k."productId" = p.id
    `;
    const args: unknown[] = [];

    if (productId) {
      sql += ` WHERE k."productId" = ?`;
      args.push(productId);
    }

    sql += ` ORDER BY k."createdAt" DESC LIMIT 200`;

    const result = await client.execute({ sql, args });
    const keys = result.rows.map((row) => ({
      id: row.id as string,
      code: row.code as string,
      productId: row.productId as string,
      isSold: Boolean(Number(row.isSold)),
      soldAt: row.soldAt ? String(row.soldAt) : null,
      soldTo: row.soldTo ? String(row.soldTo) : null,
      createdAt: String(row.createdAt),
      product: {
        id: row.productId as string,
        name: row.productName as string,
        description: row.productDescription as string | null,
        duration: row.productDuration as string,
        credits: Number(row.productCredits),
        isActive: Boolean(Number(row.productIsActive)),
        createdAt: String(row.productCreatedAt),
      },
    }));

    return NextResponse.json({ keys });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/keys — Adicionar keys (admin)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const client = getClient();
    const { productId, codes } = await request.json();

    if (!productId || !codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: 'productId e codes (array) são obrigatórios' }, { status: 400 });
    }

    const productResult = await client.execute({
      sql: `SELECT id FROM "Product" WHERE id = ?`,
      args: [productId],
    });
    if (productResult.rows.length === 0) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    const results = [];
    for (const code of codes) {
      try {
        const id = 'k_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await client.execute({
          sql: `INSERT INTO "Key" (id, code, "productId") VALUES (?, ?, ?)`,
          args: [id, code.trim(), productId],
        });
        results.push({ code: code.trim(), status: 'ok' });
      } catch {
        results.push({ code, status: 'duplicada' });
      }
    }

    const added = results.filter((r) => r.status === 'ok').length;
    const duplicated = results.filter((r) => r.status === 'duplicada').length;

    return NextResponse.json({
      message: `${added} keys adicionadas, ${duplicated} duplicadas ignoradas`,
      added,
      duplicated,
      results,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/keys?id=xxx — Remover key não vendida (admin)
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  try {
    await ensureTables();
    const client = getClient();

    const keyResult = await client.execute({
      sql: `SELECT * FROM "Key" WHERE id = ?`,
      args: [id],
    });
    if (keyResult.rows.length === 0) return NextResponse.json({ error: 'Key não encontrada' }, { status: 404 });

    const key = keyResult.rows[0];
    if (Boolean(Number(key.isSold))) return NextResponse.json({ error: 'Não é possível remover uma key já vendida' }, { status: 400 });

    await client.execute({
      sql: `DELETE FROM "Key" WHERE id = ?`,
      args: [id],
    });
    return NextResponse.json({ success: true, message: 'Key removida' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}