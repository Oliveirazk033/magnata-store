import { NextRequest, NextResponse } from 'next/server';

// POST /api/admin/auth — Verificar senha de admin
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    if (password === process.env.ADMIN_SECRET) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: 'Senha incorreta' }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, error: 'Erro na requisição' }, { status: 400 });
  }
}