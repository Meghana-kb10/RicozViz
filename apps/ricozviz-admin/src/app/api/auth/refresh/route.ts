import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('rv_admin_session')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No admin refresh token cookie found' } },
        { status: 401 }
      );
    }

    const backendRes = await fetch(`${BACKEND_URL}/admin/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `rv_admin_session=${refreshToken}`
      },
      body: JSON.stringify({ refreshToken })
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      const response = NextResponse.json(data, { status: backendRes.status });
      response.cookies.delete('rv_admin_session');
      return response;
    }

    const payload = data.data || data;
    const response = NextResponse.json({
      accessToken: payload.accessToken
    });

    // Check if backend rotated refresh token via Set-Cookie
    const setCookieHeader = backendRes.headers.get('set-cookie');
    if (setCookieHeader) {
      const match = setCookieHeader.match(/rv_admin_session=([^;]+)/);
      if (match && match[1]) {
        response.cookies.set('rv_admin_session', match[1], {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60
        });
      }
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message || 'Refresh proxy error' } },
      { status: 500 }
    );
  }
}
