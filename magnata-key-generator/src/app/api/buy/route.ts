import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/buy — Comprar uma key
export async function POST(request: NextRequest) {
  try {
    const { productId, buyerInfo } = await request.json();

    if (!productId || !buyerInfo) {
      return NextResponse.json({ error: 'productId e buyerInfo são obrigatórios' }, { status: 400 });
    }

    // Buscar produto
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      return NextResponse.json({ error: 'Produto não encontrado ou indisponível' }, { status: 404 });
    }

    // Buscar uma key disponível desse produto
    const availableKey = await db.key.findFirst({
      where: { productId, isSold: false },
    });

    if (!availableKey) {
      return NextResponse.json({ error: 'Estoque esgotado para este produto' }, { status: 400 });
    }

    // Marcar como vendida e criar transação em uma transação atômica
    const now = new Date();
    const [soldKey, transaction] = await db.$transaction([
      db.key.update({
        where: { id: availableKey.id },
        data: { isSold: true, soldAt: now, soldTo: buyerInfo },
      }),
      db.transaction.create({
        data: {
          keyId: availableKey.id,
          productName: product.name,
          credits: product.credits,
          buyerInfo,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Key gerada com sucesso!',
      key: soldKey.code,
      product: product.name,
      duration: product.duration,
      credits: product.credits,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}