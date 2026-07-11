import { NextResponse } from 'next/server';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'SEU_CLIENT_ID_AQUI';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || '';

// Scopes necessários:
// - identify: info básica do usuário
// - guilds.members.read: ler membros do servidor via OAuth2
// - guilds: listar servidores do usuário (útil para seleção)
export function getScopes(): string {
  return ['identify', 'guilds.members.read', 'guilds'].join(' ');
}

export async function GET() {
  const scopes = getScopes();

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    scope: scopes,
    response_type: 'code',
    prompt: 'consent',
  });

  if (DISCORD_REDIRECT_URI) {
    params.set('redirect_uri', DISCORD_REDIRECT_URI);
  }

  const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

  return NextResponse.json({
    authUrl,
    scopes: scopes.split(' '),
    note: DISCORD_REDIRECT_URI
      ? 'Redirect URI configurada.'
      : 'Configure DISCORD_REDIRECT_URI no .env para o callback funcionar.',
  });
}