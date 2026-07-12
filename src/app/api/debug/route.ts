import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const appUrl = `${proto}://${host}`
  const redirectUri = `${appUrl}/api/auth/discord/callback`

  return NextResponse.json({
    host,
    proto,
    appUrl,
    redirectUri,
    allHeaders: Object.fromEntries(request.headers),
  })
}