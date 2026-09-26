import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { adminSession } from "@/lib/admin-session";

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

  const token = adminSession(req.cookies).token;

  if (!token && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Login stays accessible even if a present credential is expired or invalid.

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
