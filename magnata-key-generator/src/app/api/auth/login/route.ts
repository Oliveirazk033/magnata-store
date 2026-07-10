import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/auth/login — Login do usuário
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuário e senha são obrigatórios' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Usuário não encontrado ou inativo' }, { status: 401 });
    }

    if (user.password !== password) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        credits: user.credits,
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
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, credits: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}