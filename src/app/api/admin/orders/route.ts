import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, getSessionCookieName } from '@/lib/auth'
import { db } from '@/lib/db'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(getSessionCookieName())?.value
  if (!token) return null
  return verifyToken(token)
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const orders = await db.order.findMany({
      include: {
        user: { select: { displayName: true, discordUsername: true } },
        product: { select: { name: true } },
        key: { select: { code: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        userName: o.user.displayName || o.user.discordUsername,
        productName: o.product.name,
        amount: o.amount,
        status: o.status,
        payerName: o.payerName,
        key: o.key?.code || null,
        createdAt: o.createdAt,
      })),
    })
  } catch (error) {
    console.error('List admin orders error:', error)
    return NextResponse.json({ error: 'Erro ao buscar pedidos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json()
    const { orderId, action } = body

    if (!orderId || !action) {
      return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { product: true, user: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 })
    }

    if (action === 'approve') {
      if (order.status !== 'pending' && order.status !== 'paid') {
        return NextResponse.json({ error: 'Pedido nao pode ser aprovado' }, { status: 400 })
      }

      const availableKey = await db.key.findFirst({
        where: { productId: order.productId, status: 'available' },
      })

      if (!availableKey) {
        return NextResponse.json({ error: 'Sem chaves disponiveis' }, { status: 400 })
      }

      await db.order.update({
        where: { id: orderId },
        data: { status: 'approved', keyId: availableKey.id },
      })

      await db.key.update({
        where: { id: availableKey.id },
        data: { status: 'sold', userId: order.userId, orderId: order.id },
      })

      try {
        await db.notification.create({
          data: {
            userId: order.userId,
            title: 'Pedido aprovado!',
            message: `Seu pedido #${order.id.slice(-6)} (${order.product.name}) foi aprovado! Acesse "Meus Produtos" para ver sua chave.`,
          },
        })
      } catch {}

      return NextResponse.json({ success: true, key: availableKey.code })
    }

    if (action === 'reject') {
      await db.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      })

      try {
        await db.notification.create({
          data: {
            userId: order.userId,
            title: 'Pedido recusado',
            message: `Seu pedido #${order.id.slice(-6)} foi recusado.`,
          },
        })
      } catch {}

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Acao invalida' }, { status: 400 })
  } catch (error) {
    console.error('Admin order action error:', error)
    return NextResponse.json({ error: 'Erro ao processar pedido' }, { status: 500 })
  }
}