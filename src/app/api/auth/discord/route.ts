import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
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