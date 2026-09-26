import { SESSION_MARKER, expiryPath } from "./admin-session";

// Browser-side helpers that call the authenticated proxy (/api/proxy/admin/*).
// The proxy injects the httpOnly admin token, so no secret is ever in client JS.

function sessionVersion(): string {
  return document.cookie.split("; ").find((item) => item.startsWith(`${SESSION_MARKER}=`))?.slice(SESSION_MARKER.length + 1) ?? "legacy";
}
let redirecting = false;
function handleUnauthorized(res: Response, version: string) {
  if (res.status === 401 && !redirecting && sessionVersion() === version) {
    redirecting = true;
    window.location.replace(expiryPath(version, window.location.pathname + window.location.search));
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const version = sessionVersion();
  const res = await fetch(`/api/proxy/${path}`, { cache: "no-store" });
  handleUnauthorized(res, version);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return (await res.json()) as T;
}

export async function apiSend<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const version = sessionVersion();
  const res = await fetch(`/api/proxy/${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  handleUnauthorized(res, version);
  if (!res.ok) {
    const respBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(respBody.error ?? res.statusText);
  }
  return (await res.json()) as T;
}
