import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = [
  "/dashboards",
  "/visualizations",
  "/datasets",
  "/data-sources",
  "/workspace",
  "/settings",
  "/metrics",
  "/alerts",
  "/data-quality",
  "/exports",
  "/templates",
  "/audit",
];

const AUTH_ROUTES = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public shared dashboards to be viewed without authentication
  if (pathname.startsWith("/dashboards/shared")) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("rv_customer_session");
  const isAuthenticated = Boolean(authCookie?.value);

  // If user is already authenticated and visits login/register, redirect to dashboard or returnUrl
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isAuthRoute && isAuthenticated) {
    const rawReturnUrl = request.nextUrl.searchParams.get("returnUrl");
    let target = "/dashboards";
    if (rawReturnUrl && rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//")) {
      target = rawReturnUrl;
    }
    const destinationUrl = new URL(target, request.url);
    return NextResponse.redirect(destinationUrl);
  }

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      const returnUrl = pathname + request.nextUrl.search;
      loginUrl.searchParams.set("returnUrl", returnUrl);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/dashboards/:path*",
    "/visualizations/:path*",
    "/datasets/:path*",
    "/data-sources/:path*",
    "/workspace/:path*",
    "/settings/:path*",
    "/metrics/:path*",
    "/alerts/:path*",
    "/data-quality/:path*",
    "/exports/:path*",
    "/templates/:path*",
    "/audit/:path*",
  ],
};
