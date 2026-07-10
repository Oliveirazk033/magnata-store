import { NextRequest, NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

// POST /api/buy — Comprar uma key (usando créditos do usuário logado)
export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const client = getClient();
    const { productId } = await request.json();
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Faça login para gerar uma key' }, { status: 401 });
    }

    if (!productId) {
      return NextResponse.json({ error: 'productId é obrigatório' }, { status: 400 });
    }

    // Buscar usuário
    const userResult = await client.execute({
      sql: `SELECT * FROM "User" WHERE id = ?`,
      args: [userId],
    });
    if (userResult.rows.length === 0 || !Boolean(Number(userResult.rows[0].isActive))) {
      return NextResponse.json({ error: 'Usuário inválido' }, { status: 401 });
    }
    const user = userResult.rows[0];

    // Buscar produto
    const productResult = await client.execute({
      sql: `SELECT * FROM "Product" WHERE id = ?`,
      args: [productId],
    });
    if (productResult.rows.length === 0 || !Boolean(Number(productResult.rows[0].isActive))) {
      return NextResponse.json({ error: 'Produto não encontrado ou indisponível' }, { status: 404 });
    }
    const product = productResult.rows[0];

    const userCredits = Number(user.credits);
    const productCredits = Number(product.credits);

    // Verificar créditos
    if (userCredits < productCredits) {
      return NextResponse.json({
        error: `Créditos insuficientes. Você tem ${userCredits} créditos, mas precisa de ${productCredits}.`,
      }, { status: 400 });
    }

    // Buscar uma key disponível
    const availableKeyResult = await client.execute({
      sql: `SELECT * FROM "Key" WHERE "productId" = ? AND "isSold" = 0 LIMIT 1`,
      args: [productId],
    });

    if (availableKeyResult.rows.length === 0) {
      return NextResponse.json({ error: 'Estoque esgotado para este produto' }, { status: 400 });
    }

    const availableKey = availableKeyResult.rows[0];
    const now = new Date().toISOString();
    const buyerInfo = (user.displayName as string) || (user.username as string);

    // Marcar como vendida, criar transação e descontar créditos em uma transação atômica
    await client.execute('BEGIN');

    try {
      // Marcar key como vendida
      await client.execute({
        sql: `UPDATE "Key" SET "isSold" = 1, "soldAt" = ?, "soldTo" = ? WHERE id = ?`,
        args: [now, buyerInfo, availableKey.id as string],
      });

      // Criar transação
      const transactionId = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      await client.execute({
        sql: `INSERT INTO "Transaction" (id, "keyId", "productName", credits, "buyerInfo", "userId") VALUES (?, ?, ?, ?, ?, ?)`,
        args: [transactionId, availableKey.id as string, product.name as string, productCredits, buyerInfo, userId],
      });

      // Descontar créditos do usuário
      await client.execute({
        sql: `UPDATE "User" SET credits = credits - ? WHERE id = ?`,
        args: [productCredits, userId],
      });

      await client.execute('COMMIT');
    } catch (txError) {
      await client.execute('ROLLBACK');
      throw txError;
    }

    return NextResponse.json({
      success: true,
      message: 'Key gerada com sucesso!',
      key: availableKey.code as string,
      product: product.name as string,
      duration: product.duration as string,
      creditsUsed: productCredits,
      remainingCredits: userCredits - productCredits,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}