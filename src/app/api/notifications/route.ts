import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, getSessionCookieName } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(getSessionCookieName())?.value
    if (!token) {
      return NextResponse.json({ notifications: [] })
    }
    const session = await verifyToken(token)
    if (!session) {
      return NextResponse.json({ notifications: [] })
    }

    const notifications = await db.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('Notifications error:', error)
    return NextResponse.json({ notifications: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(getSessionCookieName())?.value
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }
    const session = await verifyToken(token)
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { ids } = body

    if (ids && Array.isArray(ids)) {
      await db.notification.updateMany({
        where: { id: { in: ids }, userId: session.userId },
        data: { read: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mark notifications error:', error)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}