import { NextRequest, NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

// POST /api/auth/login — Login do usuário
export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const client = getClient();
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuário e senha são obrigatórios' }, { status: 400 });
    }

    const result = await client.execute({
      sql: `SELECT * FROM "User" WHERE username = ?`,
      args: [username.trim().toLowerCase()],
    });

    if (result.rows.length === 0 || !Boolean(Number(result.rows[0].isActive))) {
      return NextResponse.json({ error: 'Usuário não encontrado ou inativo' }, { status: 401 });
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id as string,
        username: user.username as string,
        displayName: user.displayName as string,
        credits: Number(user.credits),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/auth/login — Verificar sessão do usuário
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    await ensureTables();
    const client = getClient();

    const result = await client.execute({
      sql: `SELECT id, username, "displayName", credits, "isActive" FROM "User" WHERE id = ?`,
      args: [userId],
    });

    if (result.rows.length === 0 || !Boolean(Number(result.rows[0].isActive))) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 });
    }

    const user = result.rows[0];
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