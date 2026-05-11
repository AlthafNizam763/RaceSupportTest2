import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const REDIRECT_IF_AUTHENTICATED_ROUTES = new Set(["/login", "/register", "/forgot-password"]);
const SESSION_COOKIE_NAME = "race_cms_session";

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = Boolean(sessionCookie);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !isAuthenticated) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (REDIRECT_IF_AUTHENTICATED_ROUTES.has(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register", "/forgot-password", "/verify-email", "/reset-password"],
};
