import { NextRequest, NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

// GET /api/links — List active links (anyone) or all (admin)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  const isAdmin = authHeader === process.env.ADMIN_SECRET;

  try {
    await ensureTables();
    const client = getClient();

    const sql = isAdmin
      ? `SELECT * FROM "Link" ORDER BY "sortOrder" ASC, "createdAt" DESC`
      : `SELECT * FROM "Link" WHERE "isActive" = 1 ORDER BY "sortOrder" ASC, "createdAt" DESC`;

    const result = await client.execute({ sql, args: [] });
    const links = result.rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      url: row.url as string,
      description: (row.description as string) || null,
      sortOrder: Number(row.sortOrder),
      isActive: Boolean(Number(row.isActive)),
      createdAt: String(row.createdAt),
    }));

    return NextResponse.json({ links });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/links — Create link (admin)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const client = getClient();
    const { title, url, description } = await request.json();

    if (!title || !url) {
      return NextResponse.json({ error: 'title e url são obrigatórios' }, { status: 400 });
    }

    // Get next sort order
    const maxResult = await client.execute(`SELECT MAX("sortOrder") as m FROM "Link"`);
    const nextSort = Number(maxResult.rows[0].m ?? -1) + 1;

    const id = 'lnk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    await client.execute({
      sql: `INSERT INTO "Link" (id, title, url, description, "sortOrder") VALUES (?, ?, ?, ?, ?)`,
      args: [id, title.trim(), url.trim(), (description || '').trim(), nextSort],
    });

    return NextResponse.json({
      link: { id, title: title.trim(), url: url.trim(), description: (description || '').trim() || null, sortOrder: nextSort, isActive: true, createdAt: new Date().toISOString() },
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/links?id=xxx — Delete link (admin)
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
    await client.execute({ sql: `DELETE FROM "Link" WHERE id = ?`, args: [id] });
    return NextResponse.json({ success: true, message: 'Link removido' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}