import "server-only";
import { cookies } from "next/headers";

// Server-side client for the WeLockin backend admin API. The admin JWT lives in
// an httpOnly cookie so it is never exposed to browser JS; server components and
// route handlers read it from here.

export { COOKIE_NAME } from "./admin-session";
import { adminSession, expiryPath } from "./admin-session";

export function backendBase(): string {
  const base = process.env.BACKEND_API_URL ?? "https://app.connect.welock.in/api";
  return base.replace(/\/$/, "");
}

export async function getAdminToken(): Promise<string | undefined> {
  return adminSession(await cookies()).token;
}

export class BackendError extends Error {
  status: number;
  constructor(status: number, message: string, public sessionVersion = "legacy") {
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
  // Capturer la génération avant le fetch permet au handler d'expiration
  // d'ignorer cette erreur si une nouvelle connexion termine entre-temps.
  const session = adminSession(await cookies());
  const token = session.token;
  if (!token) throw new BackendError(401, "Not authenticated", session.version);
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
    throw new BackendError(res.status, message, session.version);
  }
  return (await res.json()) as T;
}

export function expiredSessionRedirect(error: BackendError, from = "/") {
  return expiryPath(error.sessionVersion, from);
}
