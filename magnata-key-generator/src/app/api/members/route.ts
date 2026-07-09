import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const members = await db.discordMember.findMany({
      orderBy: { joinedAt: 'desc' },
    });

    const formatted = members.map((m) => ({
      id: m.id,
      discordId: m.discordId,
      username: m.username,
      discriminator: m.discriminator,
      displayName: m.displayName,
      avatar: m.avatar
        ? `https://cdn.discordapp.com/avatars/${m.discordId}/${m.avatar}.png`
        : null,
      isBot: m.isBot,
      joinedAt: m.joinedAt.toISOString(),
      lastSeenAt: m.lastSeenAt.toISOString(),
    }));

    return NextResponse.json({ members: formatted, total: formatted.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const result = await db.discordMember.deleteMany();
    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `${result.count} membros removidos do banco de dados.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}