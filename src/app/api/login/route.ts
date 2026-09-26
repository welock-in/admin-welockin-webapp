import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendBase } from "@/lib/backend";

import { randomUUID } from "node:crypto";
import { adminSession, COOKIE_NAME, SESSION_MARKER, COOKIE_OPTIONS } from "@/lib/admin-session";

// Proxies the login to the backend and, on success, stores the returned admin
// JWT in an httpOnly cookie. The browser never sees the raw token.
export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const res = await fetch(`${backendBase()}/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: body.username, password: body.password }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };

  if (!res.ok || !data.token) {
    return NextResponse.json(
      { error: data.error ?? "Login failed" },
      { status: res.status === 200 ? 502 : res.status },
    );
  }

  const jar = await cookies();
  const previous = adminSession(jar);
  const version = randomUUID();
  jar.delete(previous.cookieName);
  jar.delete(COOKIE_NAME);
  jar.set(`${COOKIE_NAME}_${version}`, data.token, COOKIE_OPTIONS);
  // This random generation identifies a login; it is not an authentication token.
  jar.set(SESSION_MARKER, version, { ...COOKIE_OPTIONS, httpOnly: false });

  return NextResponse.json({ ok: true });
}
