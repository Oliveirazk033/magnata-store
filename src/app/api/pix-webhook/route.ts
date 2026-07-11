import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function namesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1)
  const n2 = normalizeName(name2)
  if (n1 === n2) return true
  const parts1 = n1.split(' ')
  const parts2 = n2.split(' ')
  if (parts1[0] === parts2[0] && parts1.length > 1 && parts2.length > 1) {
    const last1 = parts1[parts1.length - 1]
    const last2 = parts2[parts2.length - 1]
    if (last1 === last2) return true
    if (last1.startsWith(last2) || last2.startsWith(last1)) return true
  }
  return false
}

export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get('x-webhook-secret')
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { amount, payerName } = body

    if (!amount || !payerName) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    const amountInCents = Math.round(Number(amount) * 100)

    const order = await db.order.findFirst({
      where: { amount: amountInCents, status: 'pending' },
      include: { product: true, user: true },
    })

    if (!order) {
      return NextResponse.json({ message: 'No matching order found', matched: false })
    }

    if (!namesMatch(payerName, order.payerName || '')) {
      console.log(`Name mismatch: PIX="${payerName}" vs Order="${order.payerName}"`)
      return NextResponse.json({ message: 'Name does not match', matched: false, orderId: order.id })
    }

    const availableKey = await db.key.findFirst({
      where: { productId: order.productId, status: 'available' },
    })

    if (!availableKey) {
      return NextResponse.json({ message: 'No keys available', matched: false, orderId: order.id })
    }

    await db.order.update({
      where: { id: order.id },
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
          message: `Seu pedido #${order.id.slice(-6)} (${order.product.name}) foi aprovado automaticamente! Acesse "Meus Produtos" para ver sua chave.`,
        },
      })
    } catch {}

    return NextResponse.json({ message: 'Order approved', matched: true, orderId: order.id, key: availableKey.code })
  } catch (error) {
    console.error('PIX webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}