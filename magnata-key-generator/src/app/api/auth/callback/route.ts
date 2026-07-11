import { NextRequest, NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || '';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '';

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name: string | null;
  bot: boolean;
}

interface DiscordGuildMember {
  user: DiscordUser;
  nick: string | null;
  joined_at: string;
  roles: string[];
}

async function exchangeCode(code: string): Promise<DiscordTokenResponse> {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<DiscordTokenResponse> {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function fetchCurrentUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch user (${res.status})`);
  return res.json();
}

async function fetchGuildMembers(accessToken: string): Promise<DiscordGuildMember[]> {
  if (!DISCORD_GUILD_ID) {
    throw new Error('DISCORD_GUILD_ID precisa estar configurado no .env');
  }

  const members: DiscordGuildMember[] = [];
  let after = '0';

  do {
    const url = `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members?limit=100&after=${after}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch guild members (${res.status}): ${text}`);
    }

    const batch: DiscordGuildMember[] = await res.json();
    members.push(...batch);
    after = batch.length > 0 ? batch[batch.length - 1].user.id : '0';
  } while (members.length > 0 && after !== '0');

  return members;
}

async function upsertDiscordMember(client: ReturnType<typeof getClient>, member: DiscordGuildMember) {
  if (!member.user) return;

  const existing = await client.execute({
    sql: `SELECT id FROM "DiscordMember" WHERE "discordId" = ?`,
    args: [member.user.id],
  });

  const displayName = member.nick || member.user.global_name || member.user.username;
  const isBot = member.user.bot ? 1 : 0;

  if (existing.rows.length > 0) {
    await client.execute({
      sql: `UPDATE "DiscordMember" SET username = ?, discriminator = ?, "displayName" = ?, avatar = ?, "isBot" = ? WHERE "discordId" = ?`,
      args: [member.user.username, member.user.discriminator, displayName, member.user.avatar, isBot, member.user.id],
    });
  } else {
    const id = 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const now = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO "DiscordMember" (id, "discordId", username, discriminator, "displayName", avatar, "isBot", "joinedAt", "lastSeenAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, member.user.id, member.user.username, member.user.discriminator, displayName, member.user.avatar, isBot, member.joined_at || now, now],
    });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Código de autorização não fornecido' }, { status: 400 });
  }

  try {
    await ensureTables();
    const client = getClient();

    // Ensure additional tables exist
    try {
      await client.execute(`CREATE TABLE IF NOT EXISTS "OAuthToken" ("id" TEXT NOT NULL PRIMARY KEY, "discordId" TEXT NOT NULL UNIQUE, "accessToken" TEXT NOT NULL, "refreshToken" TEXT NOT NULL, "expiresAt" DATETIME NOT NULL, "scope" TEXT)`);
    } catch { /* ok */ }
    try {
      await client.execute(`CREATE TABLE IF NOT EXISTS "DiscordMember" ("id" TEXT NOT NULL PRIMARY KEY, "discordId" TEXT NOT NULL UNIQUE, "username" TEXT NOT NULL, "discriminator" TEXT NOT NULL DEFAULT '0', "displayName" TEXT NOT NULL, "avatar" TEXT, "isBot" BOOLEAN NOT NULL DEFAULT 0, "joinedAt" DATETIME, "lastSeenAt" DATETIME)`);
    } catch { /* ok */ }

    // 1. Trocar code por tokens (access + refresh)
    const tokenData = await exchangeCode(code);

    // 2. Buscar dados do usuário autenticado
    const currentUser = await fetchCurrentUser(tokenData.access_token);

    // 3. Calcular expiração do token
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // 4. Salvar tokens no banco (upsert)
    const existingToken = await client.execute({
      sql: `SELECT id FROM "OAuthToken" WHERE "discordId" = ?`,
      args: [currentUser.id],
    });

    if (existingToken.rows.length > 0) {
      await client.execute({
        sql: `UPDATE "OAuthToken" SET "accessToken" = ?, "refreshToken" = ?, "expiresAt" = ?, "scope" = ? WHERE "discordId" = ?`,
        args: [tokenData.access_token, tokenData.refresh_token, expiresAt.toISOString(), tokenData.scope, currentUser.id],
      });
    } else {
      const tokenId = 'o_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      await client.execute({
        sql: `INSERT INTO "OAuthToken" (id, "discordId", "accessToken", "refreshToken", "expiresAt", "scope") VALUES (?, ?, ?, ?, ?, ?)`,
        args: [tokenId, currentUser.id, tokenData.access_token, tokenData.refresh_token, expiresAt.toISOString(), tokenData.scope],
      });
    }

    // 5. Buscar e salvar membros do servidor
    let memberCount = 0;
    if (DISCORD_GUILD_ID) {
      try {
        const guildMembers = await fetchGuildMembers(tokenData.access_token);
        for (const member of guildMembers) {
          await upsertDiscordMember(client, member);
        }
        memberCount = guildMembers.length;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('Erro ao buscar membros:', msg);
      }
    }

    // 6. Salvar o próprio usuário autenticado como membro
    const selfMember: DiscordGuildMember = {
      user: currentUser,
      nick: null,
      joined_at: new Date().toISOString(),
      roles: [],
    };
    await upsertDiscordMember(client, selfMember);

    return NextResponse.json({
      success: true,
      user: {
        id: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.global_name || currentUser.username,
        avatar: currentUser.avatar
          ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`
          : null,
      },
      membersSynced: memberCount,
      tokenExpiresAt: expiresAt.toISOString(),
      message: memberCount > 0
        ? `Autenticado com sucesso! ${memberCount} membros sincronizados. Token salvo com refresh.`
        : 'Autenticado com sucesso! Configure DISCORD_GUILD_ID no .env para sincronizar membros.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/auth/callback — Endpoint para refresh de token
export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const client = getClient();

    // Ensure additional tables exist
    try {
      await client.execute(`CREATE TABLE IF NOT EXISTS "OAuthToken" ("id" TEXT NOT NULL PRIMARY KEY, "discordId" TEXT NOT NULL UNIQUE, "accessToken" TEXT NOT NULL, "refreshToken" TEXT NOT NULL, "expiresAt" DATETIME NOT NULL, "scope" TEXT)`);
    } catch { /* ok */ }
    try {
      await client.execute(`CREATE TABLE IF NOT EXISTS "DiscordMember" ("id" TEXT NOT NULL PRIMARY KEY, "discordId" TEXT NOT NULL UNIQUE, "username" TEXT NOT NULL, "discriminator" TEXT NOT NULL DEFAULT '0', "displayName" TEXT NOT NULL, "avatar" TEXT, "isBot" BOOLEAN NOT NULL DEFAULT 0, "joinedAt" DATETIME, "lastSeenAt" DATETIME)`);
    } catch { /* ok */ }

    const body = await request.json();
    const { discordId } = body;

    if (!discordId) {
      return NextResponse.json({ error: 'discordId é obrigatório' }, { status: 400 });
    }

    // Buscar tokens salvos
    const tokenResult = await client.execute({
      sql: `SELECT * FROM "OAuthToken" WHERE "discordId" = ?`,
      args: [discordId],
    });

    if (tokenResult.rows.length === 0) {
      return NextResponse.json({ error: 'Nenhum token encontrado para esse usuário' }, { status: 404 });
    }

    const tokenRecord = tokenResult.rows[0];

    // Verificar se o token ainda é válido (com margem de 1 hora)
    const now = new Date();
    const expiresAt = new Date(String(tokenRecord.expiresAt));
    const isExpired = now >= new Date(expiresAt.getTime() - 3600 * 1000);

    if (!isExpired) {
      return NextResponse.json({
        success: true,
        message: 'Token ainda válido',
        expiresAt: expiresAt.toISOString(),
        refreshed: false,
      });
    }

    // Token expirado — usar refresh_token
    const newTokenData = await refreshAccessToken(String(tokenRecord.refreshToken));
    const newExpiresAt = new Date(Date.now() + newTokenData.expires_in * 1000);

    // Atualizar tokens no banco
    await client.execute({
      sql: `UPDATE "OAuthToken" SET "accessToken" = ?, "refreshToken" = ?, "expiresAt" = ?, "scope" = ? WHERE "discordId" = ?`,
      args: [newTokenData.access_token, newTokenData.refresh_token, newExpiresAt.toISOString(), newTokenData.scope, discordId],
    });

    // Re-sincronizar membros com o novo token
    let memberCount = 0;
    if (DISCORD_GUILD_ID) {
      try {
        const guildMembers = await fetchGuildMembers(newTokenData.access_token);
        for (const member of guildMembers) {
          await upsertDiscordMember(client, member);
        }
        memberCount = guildMembers.length;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('Erro ao re-sincronizar membros:', msg);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Token renovado e membros re-sincronizados',
      expiresAt: newExpiresAt.toISOString(),
      refreshed: true,
      membersSynced: memberCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}