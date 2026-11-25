import { NextRequest, NextResponse } from 'next/server';
import { getAdminBackendUrl } from '../../../../lib/server-api-url';

export async function POST(request: NextRequest) {
  try {
    const BACKEND_URL = getAdminBackendUrl();
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
