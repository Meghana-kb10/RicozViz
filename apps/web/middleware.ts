import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = [
  "/dashboards",
  "/visualizations",
  "/datasets",
  "/data-sources",
  "/workspace",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected) {
    const authCookie = request.cookies.get("ricozviz_auth");
    if (!authCookie || !authCookie.value) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboards/:path*",
    "/visualizations/:path*",
    "/datasets/:path*",
    "/data-sources/:path*",
    "/workspace/:path*",
    "/settings/:path*",
  ],
};
