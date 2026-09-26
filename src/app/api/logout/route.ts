import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSession } from "@/lib/admin-session";

export async function POST() {
  const jar = await cookies();
  jar.delete(adminSession(jar).cookieName);
  return NextResponse.json({ ok: true });
}
