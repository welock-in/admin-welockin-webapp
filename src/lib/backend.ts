import "server-only";
import { cookies } from "next/headers";

// Server-side client for the WeLockin backend admin API. The admin JWT lives in
// an httpOnly cookie so it is never exposed to browser JS; server components and
// route handlers read it from here.

export const COOKIE_NAME = "wl_admin";

export function backendBase(): string {
  const base = process.env.BACKEND_API_URL ?? "https://app.connect.welock.in/api";
  return base.replace(/\/$/, "");
}

export function getAdminToken(): string | undefined {
  return cookies().get(COOKIE_NAME)?.value;
}

export class BackendError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "BackendError";
  }
}

/**
 * Authenticated GET against the backend admin API, from a Server Component.
 * Throws BackendError (with .status) on a non-2xx response; a 401 means the
 * admin session expired and the caller should redirect to /login.
 */
export async function backendGet<T>(path: string): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new BackendError(401, "Not authenticated");
  const res = await fetch(`${backendBase()}${path.startsWith("/") ? path : `/${path}`}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* non-json error body */
    }
    throw new BackendError(res.status, message);
  }
  return (await res.json()) as T;
}
