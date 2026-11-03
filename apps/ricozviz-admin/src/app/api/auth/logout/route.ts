import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('rv_admin_session')?.value;

    if (refreshToken) {
      await fetch(`${BACKEND_URL}/admin/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `rv_admin_session=${refreshToken}`
        },
        body: JSON.stringify({ refreshToken })
      }).catch(() => {});
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.delete('rv_admin_session');
    return response;
  } catch (error: any) {
    const response = NextResponse.json({ success: true, message: 'Logged out' });
    response.cookies.delete('rv_admin_session');
    return response;
  }
}
