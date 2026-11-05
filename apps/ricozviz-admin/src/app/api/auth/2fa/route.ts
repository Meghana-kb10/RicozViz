import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pendingToken, totpCode, backupCode } = body;

    if (!pendingToken) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing two-factor authentication pending token' } },
        { status: 401 }
      );
    }

    const backendRes = await fetch(`${BACKEND_URL}/admin/auth/totp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pendingToken}`,
        'x-forwarded-for': request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
        'user-agent': request.headers.get('user-agent') || 'ricozviz-admin-bff'
      },
      body: JSON.stringify({ totpCode, backupCode })
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    const payload = data.data || data;
    const refreshToken = payload.refreshToken;
    const response = NextResponse.json({
      accessToken: payload.accessToken,
      user: payload.user,
      backupCodes: payload.backupCodes
    });

    if (refreshToken) {
      response.cookies.set('rv_admin_session', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message || 'Two-factor verification proxy error' } },
      { status: 500 }
    );
  }
}
