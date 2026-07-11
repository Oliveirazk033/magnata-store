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

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Faca login para continuar' }, { status: 401 })
    }

    const body = await request.json()
    const { productId, payerName } = body

    if (!productId || !payerName) {
      return NextResponse.json({ error: 'Produto e nome sao obrigatorios' }, { status: 400 })
    }

    const product = await db.product.findFirst({
      where: { id: productId, active: true },
      include: {
        _count: {
          select: { keys: { where: { status: 'available' } } },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto nao encontrado' }, { status: 404 })
    }

    if (product._count.keys === 0) {
      return NextResponse.json({ error: 'Produto esgotado' }, { status: 400 })
    }

    const basePrice = product.price
    const pendingOrders = await db.order.findMany({
      where: {
        status: { in: ['pending', 'paid'] },
        amount: { gte: basePrice, lte: basePrice + 99 },
      },
      select: { amount: true },
    })

    const usedAmounts = new Set(pendingOrders.map((o) => o.amount))
    let uniqueAmount = basePrice
    for (let i = 1; i <= 99; i++) {
      if (!usedAmounts.has(basePrice + i)) {
        uniqueAmount = basePrice + i
        break
      }
    }

    const pixKey = process.env.PIX_KEY || ''

    const order = await db.order.create({
      data: {
        userId: session.userId,
        productId,
        amount: uniqueAmount,
        status: 'pending',
        pixCode: pixKey,
        payerName,
      },
      include: { product: true },
    })

    try {
      await db.notification.create({
        data: {
          userId: session.userId,
          title: 'Pedido criado',
          message: `Seu pedido #${order.id.slice(-6)} foi criado. Valor: R$ ${(uniqueAmount / 100).toFixed(2)}`,
        },
      })
    } catch {}

    return NextResponse.json({
      order: {
        id: order.id,
        amount: order.amount,
        status: order.status,
        pixCode: order.pixCode,
        payerName: order.payerName,
        productName: order.product.name,
        createdAt: order.createdAt,
      },
    })
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const orders = await db.order.findMany({
      where: { userId: session.userId },
      include: {
        product: { select: { name: true } },
        key: { select: { code: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        productName: o.product.name,
        amount: o.amount,
        status: o.status,
        payerName: o.payerName,
        key: o.key?.code || null,
        createdAt: o.createdAt,
      })),
    })
  } catch (error) {
    console.error('List orders error:', error)
    return NextResponse.json({ error: 'Erro ao buscar pedidos' }, { status: 500 })
  }
}