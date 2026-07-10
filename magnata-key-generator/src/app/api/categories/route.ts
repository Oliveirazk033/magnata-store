import { NextRequest, NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

// GET /api/categories — Listar categorias
export async function GET(request: NextRequest) {
  try {
    await ensureTables();
    const client = getClient();
    const isAdmin = request.headers.get('x-admin-key') === process.env.ADMIN_SECRET;

    let result;
    try {
      result = await client.execute({
        sql: `SELECT c.*,
          (SELECT COUNT(*) FROM "Product" p WHERE p."categoryId" = c.id AND p."isActive" = 1) as "productCount"
          FROM "Category" c
          ${!isAdmin ? 'WHERE c."isActive" = 1' : ''}
          ORDER BY c."sortOrder" ASC, c."createdAt" ASC`,
        args: [],
      });
    } catch {
      // Fallback: categoryId column might not exist yet on Product
      result = await client.execute({
        sql: `SELECT c.*, 0 as "productCount" FROM "Category" c
          ${!isAdmin ? 'WHERE c."isActive" = 1' : ''}
          ORDER BY c."sortOrder" ASC, c."createdAt" ASC`,
        args: [],
      });
    }

    const categories = result.rows.map((row: any) => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | null,
      sortOrder: Number(row.sortOrder),
      isActive: Boolean(row.isActive),
      productCount: Number(row.productCount),
      createdAt: String(row.createdAt),
    }));

    return NextResponse.json({ categories });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/categories — Criar categoria (admin)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const client = getClient();
    const body = await request.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 });
    }

    // Get next sort order
    const maxResult = await client.execute(`SELECT MAX("sortOrder") as maxSort FROM "Category"`);
    const nextSort = (Number((maxResult.rows[0] as any).maxSort) || 0) + 1;

    const id = 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    await client.execute({
      sql: `INSERT INTO "Category" ("id", "name", "description", "sortOrder", "isActive") VALUES (?, ?, ?, ?, 1)`,
      args: [id, name.trim(), description?.trim() || null, nextSort],
    });

    const category = { id, name: name.trim(), description: description?.trim() || null, sortOrder: nextSort, isActive: true, createdAt: new Date().toISOString() };
    return NextResponse.json({ category }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/categories?id=xxx — Desativar categoria (admin)
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
    await client.execute({ sql: `UPDATE "Category" SET "isActive" = 0 WHERE "id" = ?`, args: [id] });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}