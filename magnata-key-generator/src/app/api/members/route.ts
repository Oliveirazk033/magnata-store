import { NextResponse } from 'next/server';
import { getClient, ensureTables } from '@/lib/db';

export async function GET() {
  try {
    await ensureTables();
    const client = getClient();

    // Ensure table exists
    try {
      await client.execute(`CREATE TABLE IF NOT EXISTS "DiscordMember" ("id" TEXT NOT NULL PRIMARY KEY, "discordId" TEXT NOT NULL UNIQUE, "username" TEXT NOT NULL, "discriminator" TEXT NOT NULL DEFAULT '0', "displayName" TEXT NOT NULL, "avatar" TEXT, "isBot" BOOLEAN NOT NULL DEFAULT 0, "joinedAt" DATETIME, "lastSeenAt" DATETIME)`);
    } catch { /* ok */ }

    const result = await client.execute({
      sql: `SELECT * FROM "DiscordMember" ORDER BY "joinedAt" DESC`,
      args: [],
    });

    const formatted = result.rows.map((m) => ({
      id: m.id as string,
      discordId: m.discordId as string,
      username: m.username as string,
      discriminator: m.discriminator as string,
      displayName: m.displayName as string,
      avatar: m.avatar
        ? `https://cdn.discordapp.com/avatars/${m.discordId}/${m.avatar}.png`
        : null,
      isBot: Boolean(Number(m.isBot)),
      joinedAt: m.joinedAt ? String(m.joinedAt) : new Date().toISOString(),
      lastSeenAt: m.lastSeenAt ? String(m.lastSeenAt) : new Date().toISOString(),
    }));

    return NextResponse.json({ members: formatted, total: formatted.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await ensureTables();
    const client = getClient();

    // Ensure table exists
    try {
      await client.execute(`CREATE TABLE IF NOT EXISTS "DiscordMember" ("id" TEXT NOT NULL PRIMARY KEY, "discordId" TEXT NOT NULL UNIQUE, "username" TEXT NOT NULL, "discriminator" TEXT NOT NULL DEFAULT '0', "displayName" TEXT NOT NULL, "avatar" TEXT, "isBot" BOOLEAN NOT NULL DEFAULT 0, "joinedAt" DATETIME, "lastSeenAt" DATETIME)`);
    } catch { /* ok */ }

    const result = await client.execute({ sql: `DELETE FROM "DiscordMember"`, args: [] });

    return NextResponse.json({
      success: true,
      deleted: result.rowsAffected,
      message: `${result.rowsAffected} membros removidos do banco de dados.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}