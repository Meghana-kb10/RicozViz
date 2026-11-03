import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get('rv_admin_session')?.value;

  if (!refreshToken) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    // Basic JWT structure validation (header.payload.signature)
    const parts = refreshToken.split('.');
    if (parts.length !== 3) {
      return NextResponse.json({ authenticated: false });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    const isExpired = payload.exp && payload.exp * 1000 < Date.now();

    if (isExpired || payload.aud !== 'admin' || payload.type !== 'refresh') {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      userId: payload.sub
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
