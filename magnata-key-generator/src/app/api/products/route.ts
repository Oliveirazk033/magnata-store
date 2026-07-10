import { NextRequest, NextResponse } from 'next/server';
import { db, ensureTables } from '@/lib/db';

// GET /api/products — Listar produtos ativos (público)
export async function GET() {
  try {
    await ensureTables();
    const products = await db().product.findMany({
      where: { isActive: true },
      include: { _count: { select: { keys: { where: { isSold: false } } } } },
      orderBy: { credits: 'asc' },
    });
    return NextResponse.json({ products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/products — Criar produto (admin)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    await ensureTables();
    const body = await request.json();
    const { name, description, duration, credits } = body;

    if (!name || !duration || credits === undefined) {
      return NextResponse.json({ error: 'name, duration e credits sao obrigatorios' }, { status: 400 });
    }

    const product = await db().product.create({
      data: { name, description: description || null, duration, credits: Number(credits) },
    });
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
    const product = await db().product.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ product });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}