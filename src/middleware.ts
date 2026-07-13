import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "wl_admin";

// Gate every page behind the admin session cookie. The login page and its API
// route are public; everything else redirects to /login when unauthenticated.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API routes enforce their own auth (the proxy returns 401, login is public),
  // so middleware only gates page navigations.
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Already logged in but visiting /login → send to the dashboard.
  if (token && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
