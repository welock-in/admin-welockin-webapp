import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/backend";

export async function POST() {
  cookies().delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
