import { NextRequest, NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

// POST /api/auth/register — Criar usuário (admin)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const client = getClient();
    const { username, password, displayName, credits } = await request.json();

    if (!username || !password || !displayName) {
      return NextResponse.json({ error: 'username, password e displayName são obrigatórios' }, { status: 400 });
    }

    const existing = await client.execute({
      sql: `SELECT id FROM "User" WHERE username = ?`,
      args: [username],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Nome de usuário já existe' }, { status: 400 });
    }

    const id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const now = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO "User" (id, username, password, "displayName", credits, "isActive", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [id, username.trim().toLowerCase(), password, displayName, Number(credits) || 0, now, now],
    });

    return NextResponse.json({
      user: { id, username: username.trim().toLowerCase(), displayName, credits: Number(credits) || 0 },
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/auth/register — Listar usuários (admin)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const client = getClient();

    const result = await client.execute({
      sql: `SELECT id, username, "displayName", credits, "isActive", "createdAt" FROM "User" ORDER BY "createdAt" DESC`,
      args: [],
    });
    const users = result.rows.map((row) => ({
      id: row.id as string,
      username: row.username as string,
      displayName: row.displayName as string,
      credits: Number(row.credits),
      isActive: Boolean(Number(row.isActive)),
      createdAt: String(row.createdAt),
    }));

    return NextResponse.json({ users });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/auth/register — Editar créditos do usuário (admin)
export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const client = getClient();
    const { userId, credits, displayName, isActive } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    const setClauses: string[] = [];
    const args: unknown[] = [];

    if (credits !== undefined) {
      setClauses.push(`credits = ?`);
      args.push(Number(credits));
    }
    if (displayName !== undefined) {
      setClauses.push(`"displayName" = ?`);
      args.push(displayName);
    }
    if (isActive !== undefined) {
      setClauses.push(`"isActive" = ?`);
      args.push(isActive ? 1 : 0);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const now = new Date().toISOString();
    setClauses.push(`"updatedAt" = ?`);
    args.push(now);
    args.push(userId);

    const sql = `UPDATE "User" SET ${setClauses.join(', ')} WHERE id = ?`;
    await client.execute({ sql, args });

    // Fetch updated user
    const updatedResult = await client.execute({
      sql: `SELECT id, username, "displayName", credits, "isActive" FROM "User" WHERE id = ?`,
      args: [userId],
    });

    if (updatedResult.rows.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const user = updatedResult.rows[0];
    return NextResponse.json({
      user: {
        id: user.id as string,
        username: user.username as string,
        displayName: user.displayName as string,
        credits: Number(user.credits),
        isActive: Boolean(Number(user.isActive)),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/auth/register — Deletar usuário (admin)
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
    await client.execute({
      sql: `DELETE FROM "User" WHERE id = ?`,
      args: [id],
    });
    return NextResponse.json({ success: true, message: 'Usuário removido' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}