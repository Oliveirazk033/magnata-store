import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createToken, getSessionCookieName } from '@/lib/auth'

function getAppUrl(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const appUrl = getAppUrl(request)

  console.log('[AUTH CALLBACK] Starting Discord OAuth callback')
  console.log('[AUTH CALLBACK] appUrl:', appUrl)

  if (!code) {
    console.error('[AUTH CALLBACK] No code received')
    return NextResponse.redirect(`${appUrl}/?error=no_code`)
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  const redirectUri = `${appUrl}/api/auth/discord/callback`

  console.log('[AUTH CALLBACK] clientId exists:', !!clientId)
  console.log('[AUTH CALLBACK] clientSecret exists:', !!clientSecret)
  console.log('[AUTH CALLBACK] redirectUri:', redirectUri)

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/?error=no_discord_config`)
  }

  try {
    // Step 1: Exchange code for token
    console.log('[AUTH CALLBACK] Step 1: Exchanging code for token...')
    let tokenRes: Response
    try {
      tokenRes = await fetch('https://discord.com/api/oauth2/token', {
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
    } catch (fetchError) {
      console.error('[AUTH CALLBACK] Fetch to Discord token endpoint failed:', fetchError)
      return NextResponse.redirect(`${appUrl}/?error=discord_fetch_failed`)
    }

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text()
      console.error('[AUTH CALLBACK] Discord token error:', tokenRes.status, errorBody)
      return NextResponse.redirect(`${appUrl}/?error=token_exchange_failed&detail=${encodeURIComponent(errorBody.substring(0, 200))}`)
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token
    console.log('[AUTH CALLBACK] Step 1 OK: Got access token')

    // Step 2: Fetch Discord user
    console.log('[AUTH CALLBACK] Step 2: Fetching Discord user...')
    let userRes: Response
    try {
      userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch (fetchError) {
      console.error('[AUTH CALLBACK] Fetch to Discord user endpoint failed:', fetchError)
      return NextResponse.redirect(`${appUrl}/?error=discord_user_fetch_failed`)
    }

    if (!userRes.ok) {
      console.error('[AUTH CALLBACK] Discord user fetch error:', userRes.status)
      return NextResponse.redirect(`${appUrl}/?error=user_fetch_failed`)
    }

    const discordUser = await userRes.json()
    console.log('[AUTH CALLBACK] Step 2 OK: Discord user:', discordUser.username, 'id:', discordUser.id)

    // Step 3: Upsert user in database
    console.log('[AUTH CALLBACK] Step 3: Upserting user in database...')
    console.log('[AUTH CALLBACK] TURSO_DATABASE_URL exists:', !!process.env.TURSO_DATABASE_URL)

    let user
    try {
      user = await db.user.upsert({
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
      console.log('[AUTH CALLBACK] Step 3 OK: User saved:', user.id, 'isAdmin:', user.isAdmin)
    } catch (dbError) {
      console.error('[AUTH CALLBACK] Step 3 FAILED: Database error:', dbError)
      if (dbError instanceof Error) {
        console.error('[AUTH CALLBACK] DB error name:', dbError.name)
        console.error('[AUTH CALLBACK] DB error message:', dbError.message)
        console.error('[AUTH CALLBACK] DB error stack:', dbError.stack)
      }
      return NextResponse.redirect(`${appUrl}/?error=auth_failed&step=database&detail=${encodeURIComponent(String(dbError).substring(0, 300))}`)
    }

    // Step 4: Create JWT token
    console.log('[AUTH CALLBACK] Step 4: Creating JWT token...')
    const token = await createToken({
      userId: user.id,
      discordId: user.discordId,
      isAdmin: user.isAdmin,
    })
    console.log('[AUTH CALLBACK] Step 4 OK: Token created')

    // Step 5: Set cookie and redirect
    console.log('[AUTH CALLBACK] Step 5: Setting cookie and redirecting to', appUrl + '/')
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
    console.error('[AUTH CALLBACK] UNEXPECTED ERROR:', error)
    if (error instanceof Error) {
      console.error('[AUTH CALLBACK] Error name:', error.name)
      console.error('[AUTH CALLBACK] Error message:', error.message)
      console.error('[AUTH CALLBACK] Error stack:', error.stack)
    }
    return NextResponse.redirect(`${appUrl}/?error=auth_failed&detail=${encodeURIComponent(String(error).substring(0, 300))}`)
  }
}