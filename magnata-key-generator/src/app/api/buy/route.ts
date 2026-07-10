import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/buy — Comprar uma key (usando créditos do usuário logado)
export async function POST(request: NextRequest) {
  try {
    const { productId, buyerInfo } = await request.json();
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Faça login para gerar uma key' }, { status: 401 });
    }

    if (!productId) {
      return NextResponse.json({ error: 'productId é obrigatório' }, { status: 400 });
    }

    // Buscar usuário
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Usuário inválido' }, { status: 401 });
    }

    // Buscar produto
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      return NextResponse.json({ error: 'Produto não encontrado ou indisponível' }, { status: 404 });
    }

    // Verificar créditos
    if (user.credits < product.credits) {
      return NextResponse.json({
        error: `Créditos insuficientes. Você tem ${user.credits} créditos, mas precisa de ${product.credits}.`,
      }, { status: 400 });
    }

    // Buscar uma key disponível
    const availableKey = await db.key.findFirst({
      where: { productId, isSold: false },
    });

    if (!availableKey) {
      return NextResponse.json({ error: 'Estoque esgotado para este produto' }, { status: 400 });
    }

    // Marcar como vendida, criar transação e descontar créditos em uma transação atômica
    const now = new Date();
    const [soldKey, transaction] = await db.$transaction([
      db.key.update({
        where: { id: availableKey.id },
        data: { isSold: true, soldAt: now, soldTo: user.displayName || user.username },
      }),
      db.transaction.create({
        data: {
          keyId: availableKey.id,
          productName: product.name,
          credits: product.credits,
          buyerInfo: user.displayName || user.username,
          userId: user.id,
        },
      }),
    ]);

    // Descontar créditos do usuário
    await db.user.update({
      where: { id: userId },
      data: { credits: { decrement: product.credits } },
    });

    return NextResponse.json({
      success: true,
      message: 'Key gerada com sucesso!',
      key: soldKey.code,
      product: product.name,
      duration: product.duration,
      creditsUsed: product.credits,
      remainingCredits: user.credits - product.credits,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}