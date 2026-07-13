import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, backendBase } from "@/lib/backend";

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

  cookies().set(COOKIE_NAME, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h, matches the admin token lifetime
  });

  return NextResponse.json({ ok: true });
}
