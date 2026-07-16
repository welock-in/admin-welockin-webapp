// Browser-side helpers that call the authenticated proxy (/api/proxy/admin/*).
// The proxy injects the httpOnly admin token, so no secret is ever in client JS.

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return (await res.json()) as T;
}

export async function apiSend<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const respBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(respBody.error ?? res.statusText);
  }
  return (await res.json()) as T;
}
