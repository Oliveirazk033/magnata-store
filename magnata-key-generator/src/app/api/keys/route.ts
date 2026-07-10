import { NextRequest, NextResponse } from 'next/server';
import { db, ensureTables } from '@/lib/db';

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
    const keys = await db().key.findMany({
      where: productId ? { productId } : undefined,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
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
    const { productId, codes } = await request.json();

    if (!productId || !codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: 'productId e codes (array) são obrigatórios' }, { status: 400 });
    }

    const product = await db().product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    const results = [];
    for (const code of codes) {
      try {
        const key = await db().key.create({
          data: { code: code.trim(), productId },
        });
        results.push({ code: key.code, status: 'ok' });
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
    const key = await db().key.findUnique({ where: { id } });
    if (!key) return NextResponse.json({ error: 'Key não encontrada' }, { status: 404 });
    if (key.isSold) return NextResponse.json({ error: 'Não é possível remover uma key já vendida' }, { status: 400 });

    await db().key.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Key removida' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}