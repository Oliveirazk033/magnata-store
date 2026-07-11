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

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    const where = productId ? { productId } : {}
    const keys = await db.key.findMany({
      where,
      include: { product: { select: { name: true } }, user: { select: { displayName: true, discordUsername: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ keys })
  } catch (error) {
    console.error('List keys error:', error)
    return NextResponse.json({ error: 'Erro ao buscar chaves' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json()
    const { productId, codes } = body

    if (!productId || !codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: 'Produto e codigos sao obrigatorios' }, { status: 400 })
    }

    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json({ error: 'Produto nao encontrado' }, { status: 404 })
    }

    const created = await db.key.createMany({
      data: codes.map((code: string) => ({
        code: code.trim(),
        productId,
        status: 'available',
      })),
    })

    return NextResponse.json({ created: created.count }, { status: 201 })
  } catch (error) {
    console.error('Add keys error:', error)
    return NextResponse.json({ error: 'Erro ao adicionar chaves' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID e obrigatorio' }, { status: 400 })
    }

    await db.key.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete key error:', error)
    return NextResponse.json({ error: 'Erro ao deletar chave' }, { status: 500 })
  }
}