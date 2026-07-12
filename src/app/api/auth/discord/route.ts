import { NextRequest, NextResponse } from 'next/server'

function getAppUrl(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID
  const appUrl = getAppUrl(request)
  const redirectUri = encodeURIComponent(`${appUrl}/api/auth/discord/callback`)

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/?error=no_discord_client`)
  }

  const discordUrl =
    `https://discord.com/api/oauth2/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${redirectUri}&` +
    `response_type=code&` +
    `scope=identify`

  return NextResponse.redirect(discordUrl)
}