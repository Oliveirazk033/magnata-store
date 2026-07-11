import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, getSessionCookieName } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(getSessionCookieName())?.value

  if (!token) {
    return NextResponse.json({ user: null })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ user: null })
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      discordId: true,
      discordUsername: true,
      discordAvatar: true,
      displayName: true,
      isAdmin: true,
    },
  })

  if (!user) {
    return NextResponse.json({ user: null })
  }

  return NextResponse.json({ user })
}