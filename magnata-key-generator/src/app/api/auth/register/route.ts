import { NextRequest, NextResponse } from 'next/server';
import { db, ensureTables } from '@/lib/db';

// POST /api/auth/register — Criar usuário (admin)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const { username, password, displayName, credits } = await request.json();

    if (!username || !password || !displayName) {
      return NextResponse.json({ error: 'username, password e displayName são obrigatórios' }, { status: 400 });
    }

    const existing = await db().user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'Nome de usuário já existe' }, { status: 400 });
    }

    const user = await db().user.create({
      data: {
        username: username.trim().toLowerCase(),
        password,
        displayName,
        credits: Number(credits) || 0,
      },
    });

    return NextResponse.json({ user: { id: user.id, username: user.username, displayName: user.displayName, credits: user.credits } }, { status: 201 });
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
    const users = await db().user.findMany({
      select: { id: true, username: true, displayName: true, credits: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
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
    const { userId, credits, displayName, isActive } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (credits !== undefined) updateData.credits = Number(credits);
    if (displayName !== undefined) updateData.displayName = displayName;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await db().user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, username: true, displayName: true, credits: true, isActive: true },
    });

    return NextResponse.json({ user });
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
    await db().user.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Usuário removido' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}