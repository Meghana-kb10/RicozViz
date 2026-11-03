import { NextRequest, NextResponse } from 'next/server';

const JWT_ADMIN_SECRET =
  process.env.JWT_ADMIN_SECRET ||
  'c1b33bb340e34b62e9e9370df7dbf760c020f0e27b85b5612bf629e8d6874799';

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyAdminJwtSignature(token: string, secret: string): Promise<{ valid: boolean; payload?: any }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };

    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlDecode(parts[2]);
    const keyData = new TextEncoder().encode(secret);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const isValid = await crypto.subtle.verify('HMAC', key, signature as any, data as any);
    if (!isValid) return { valid: false };

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass public assets and internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  const isAuthPage =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/enroll-2fa';

  const sessionCookie = request.cookies.get('rv_admin_session')?.value;

  if (!sessionCookie) {
    if (isAuthPage) {
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('returnUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Cryptographic verification of session cookie
  const verification = await verifyAdminJwtSignature(sessionCookie, JWT_ADMIN_SECRET);

  if (!verification.valid || !verification.payload) {
    if (isAuthPage) {
      const response = NextResponse.next();
      response.cookies.delete('rv_admin_session');
      return response;
    }
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('rv_admin_session');
    return response;
  }

  const { aud, type, exp } = verification.payload;

  // Strict claim validations: Must be admin audience, refresh type, and unexpired
  const isExpired = exp && exp * 1000 < Date.now();
  const isValidAdminSession = aud === 'admin' && type === 'refresh' && !isExpired;

  if (!isValidAdminSession) {
    if (isAuthPage) {
      const response = NextResponse.next();
      response.cookies.delete('rv_admin_session');
      return response;
    }
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('rv_admin_session');
    return response;
  }

  // If already authenticated and visiting an auth route, redirect to /overview
  if (isAuthPage) {
    return NextResponse.redirect(new URL('/overview', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
