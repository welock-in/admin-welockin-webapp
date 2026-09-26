import { NextRequest, NextResponse } from "next/server";
import { adminSession, safeReturnPath } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const session = adminSession(req.cookies);
  const from = safeReturnPath(req.nextUrl.searchParams.get("from"));
  const expected = req.nextUrl.searchParams.get("session");
  // A response from the previous login must not sign out the new one.
  if (expected !== session.version) return NextResponse.redirect(new URL(from, req.url));
  const url = new URL("/login", req.url);
  url.searchParams.set("from", from);
  const response = NextResponse.redirect(url);
  response.cookies.delete(session.cookieName);
  return response;
}
