import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createToken, getSessionCookieName } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?error=no_code`)
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  const redirectUri = `${appUrl}/api/auth/discord/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/?error=no_discord_config`)
  }

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      console.error('Discord token error:', await tokenRes.text())
      return NextResponse.redirect(`${appUrl}/?error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!userRes.ok) {
      return NextResponse.redirect(`${appUrl}/?error=user_fetch_failed`)
    }

    const discordUser = await userRes.json()

    const user = await db.user.upsert({
      where: { discordId: discordUser.id },
      update: {
        discordUsername: discordUser.username,
        discordAvatar: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : null,
        displayName: discordUser.global_name || discordUser.username,
      },
      create: {
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        discordAvatar: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : null,
        displayName: discordUser.global_name || discordUser.username,
        isAdmin: discordUser.id === (process.env.ADMIN_DISCORD_ID || ''),
      },
    })

    const token = await createToken({
      userId: user.id,
      discordId: user.discordId,
      isAdmin: user.isAdmin,
    })

    const response = NextResponse.redirect(appUrl + '/')
    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Discord auth error:', error)
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }
}