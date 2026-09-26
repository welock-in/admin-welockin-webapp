// Each login owns a different credential cookie. An old 401 may expire only
// that cookie, never the credential installed by a concurrent new login.
export const COOKIE_NAME = "wl_admin";
export const SESSION_MARKER = "wl_admin_session";
export const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 };

type CookieReader = { get(name: string): { value: string } | undefined };
export function adminSession(cookies: CookieReader) {
  const marker = cookies.get(SESSION_MARKER)?.value;
  const version = marker && /^[a-f0-9-]{36}$/.test(marker) ? marker : "legacy";
  const cookieName = version === "legacy" ? COOKIE_NAME : `${COOKIE_NAME}_${version}`;
  return { version, cookieName, token: cookies.get(cookieName)?.value };
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/";
  try {
    const parsed = new URL(value, "https://admin.invalid");
    if (/%(?:25)*(?:2f|5c|0[0-9a-f]|1[0-9a-f]|20)/i.test(parsed.pathname)) return "/";
    if (parsed.origin !== "https://admin.invalid" || /^\/(login|api)(\/|$)/.test(parsed.pathname)) return "/";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch { return "/"; }
}

export function expiryPath(version: string, from = "/") {
  return `/api/session/expired?session=${encodeURIComponent(version)}&from=${encodeURIComponent(safeReturnPath(from))}`;
}
