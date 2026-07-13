import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, backendBase } from "@/lib/backend";

// Authenticated pass-through to the backend admin API for CLIENT components
// (live-session polling, moderation actions). Injects the httpOnly admin token
// so it is never handled by browser JS. Only /admin/* paths are allowed.

export const dynamic = "force-dynamic";

async function forward(req: Request, path: string[]): Promise<NextResponse> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Build the target and validate the FULLY-NORMALIZED resolved URL — not the raw
  // segments. Checking segments is bypassable: a segment like "..\.." (from %5C)
  // or an encoded slash (%2F) passes a naive check, then the WHATWG URL parser
  // normalizes the backslash/dot-segments and walks out of /admin, forwarding the
  // httpOnly admin token to arbitrary backend routes. Resolving first, then
  // requiring the normalized origin+path to stay under `${base}/admin/`, closes
  // every traversal variant.
  const base = new URL(backendBase());
  let target: URL;
  try {
    target = new URL(`${backendBase()}/${path.join("/")}`);
  } catch {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }
  const adminPrefix = `${base.pathname.replace(/\/+$/, "")}/admin/`;
  if (target.origin !== base.origin || !target.pathname.startsWith(adminPrefix)) {
    return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
  }
  target.search = new URL(req.url).search;

  const init: RequestInit = {
    method: req.method,
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const text = await req.text();
    if (text) {
      init.body = text;
      (init.headers as Record<string, string>)["content-type"] =
        req.headers.get("content-type") ?? "application/json";
    }
  }

  const res = await fetch(target, init);
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path);
}
export async function POST(req: Request, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path);
}
export async function DELETE(req: Request, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path);
}
