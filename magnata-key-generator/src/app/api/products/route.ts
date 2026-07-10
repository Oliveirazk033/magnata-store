import { NextRequest, NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

// GET /api/products — Listar produtos ativos (com categoryId)
// Se categoryId passado como query param, filtra por categoria
export async function GET(request: NextRequest) {
  try {
    await ensureTables();
    const client = getClient();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const isAdmin = request.headers.get('x-admin-key') === process.env.ADMIN_SECRET;

    let sql = `SELECT p.*, c.name as "categoryName" FROM "Product" p LEFT JOIN "Category" c ON p."categoryId" = c.id WHERE p."isActive" = 1`;
    const args: unknown[] = [];

    if (categoryId) {
      sql += ` AND p."categoryId" = ?`;
      args.push(categoryId);
    }

    // For users: only show products in active categories
    if (!isAdmin && categoryId) {
      // categoryId already filtered, category must be active
    } else if (!isAdmin) {
      sql += ` AND (p."categoryId" IS NULL OR c."isActive" = 1)`;
    }

    sql += ` ORDER BY c."sortOrder" ASC, p."credits" ASC`;

    const result = await client.execute({ sql, args });
    const products = result.rows.map((row: any) => ({
      id: row.id, name: row.name, description: row.description,
      duration: row.duration, credits: Number(row.credits),
      categoryId: row.categoryId as string | null,
      categoryName: row.categoryName as string | null,
      isActive: Boolean(row.isActive), createdAt: row.createdAt,
      _count: { keys: 0 },
    }));

    // Count available keys per product
    for (const p of products) {
      const kc = await client.execute({ sql: `SELECT COUNT(*) as c FROM "Key" WHERE "productId" = ? AND "isSold" = 0`, args: [p.id] });
      p._count.keys = Number(kc.rows[0].c);
    }
    return NextResponse.json({ products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/products — Criar produto (admin) com categoryId
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const client = getClient();
    const body = await request.json();
    const { name, description, duration, credits, categoryId } = body;

    if (!name || !duration || credits === undefined) {
      return NextResponse.json({ error: 'name, duration e credits sao obrigatorios' }, { status: 400 });
    }

    const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    await client.execute({
      sql: `INSERT INTO "Product" ("id", "name", "description", "duration", "credits", "categoryId", "isActive") VALUES (?, ?, ?, ?, ?, ?, 1)`,
      args: [id, name, description || null, duration, Number(credits), categoryId || null],
    });

    const product = { id, name, description: description || null, duration, credits: Number(credits), categoryId: categoryId || null, isActive: true, createdAt: new Date().toISOString() };
    return NextResponse.json({ product }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/products?id=xxx — Desativar produto (admin)
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const client = getClient();
    await client.execute({ sql: `UPDATE "Product" SET "isActive" = 0 WHERE "id" = ?`, args: [id] });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}