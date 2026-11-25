import { NextRequest, NextResponse } from 'next/server';
import { getAdminBackendUrl } from '../../../../lib/server-api-url';

export async function POST(request: NextRequest) {
  try {
    const BACKEND_URL = getAdminBackendUrl();
    const body = await request.json();
    const backendRes = await fetch(`${BACKEND_URL}/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
        'user-agent': request.headers.get('user-agent') || 'ricozviz-admin-bff'
      },
      body: JSON.stringify(body)
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    const payload = data.data || data;

    // If 2FA is required, do not set session cookie yet
    if (payload.requires2Fa) {
      return NextResponse.json({
        requires2Fa: true,
        pendingToken: payload.pendingToken,
        user: payload.user
      });
    }

    // Auth succeeded: extract refresh token from payload or set-cookie header
    const refreshToken = payload.refreshToken;
    const response = NextResponse.json({
      accessToken: payload.accessToken,
      user: payload.user
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
      { error: { code: 'INTERNAL_ERROR', message: error.message || 'Login proxy error' } },
      { status: 500 }
    );
  }
}
