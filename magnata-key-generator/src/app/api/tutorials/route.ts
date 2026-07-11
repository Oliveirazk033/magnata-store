import { NextRequest, NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

// Helper to convert YouTube URL to embed URL
function toEmbedUrl(url: string): string {
  // youtube.com/watch?v=XXX
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  // Already an embed URL
  if (url.includes('youtube.com/embed/')) return url;
  // Direct video URL or other — return as-is
  return url;
}

// GET /api/tutorials — List active tutorials (anyone) or all (admin)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  const isAdmin = authHeader === process.env.ADMIN_SECRET;

  try {
    await ensureTables();
    const client = getClient();

    const sql = isAdmin
      ? `SELECT * FROM "Tutorial" ORDER BY "sortOrder" ASC, "createdAt" DESC`
      : `SELECT * FROM "Tutorial" WHERE "isActive" = 1 ORDER BY "sortOrder" ASC, "createdAt" DESC`;

    const result = await client.execute({ sql, args: [] });
    const tutorials = result.rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      url: row.url as string,
      embedUrl: toEmbedUrl(row.url as string),
      sortOrder: Number(row.sortOrder),
      isActive: Boolean(Number(row.isActive)),
      createdAt: String(row.createdAt),
    }));

    return NextResponse.json({ tutorials });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/tutorials — Create tutorial (admin)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const client = getClient();
    const { title, url } = await request.json();

    if (!title || !url) {
      return NextResponse.json({ error: 'title e url são obrigatórios' }, { status: 400 });
    }

    // Get next sort order
    const maxResult = await client.execute(`SELECT MAX("sortOrder") as m FROM "Tutorial"`);
    const nextSort = Number(maxResult.rows[0].m ?? -1) + 1;

    const id = 'tut_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    await client.execute({
      sql: `INSERT INTO "Tutorial" (id, title, url, "sortOrder") VALUES (?, ?, ?, ?)`,
      args: [id, title.trim(), url.trim(), nextSort],
    });

    return NextResponse.json({
      tutorial: { id, title: title.trim(), url: url.trim(), embedUrl: toEmbedUrl(url.trim()), sortOrder: nextSort, isActive: true, createdAt: new Date().toISOString() },
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/tutorials?id=xxx — Delete tutorial (admin)
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
    await client.execute({ sql: `DELETE FROM "Tutorial" WHERE id = ?`, args: [id] });
    return NextResponse.json({ success: true, message: 'Tutorial removido' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}