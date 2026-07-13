"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Login failed");
        setBusy(false);
        return;
      }
      const from = new URLSearchParams(window.location.search).get("from");
      router.replace(from && from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setErr("Network error — is the backend reachable?");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-ink text-white mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2.2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            WeLockin <span className="text-accent">Admin</span>
          </h1>
          <p className="text-sm text-muted mt-1">Sign in to the operations console.</p>
        </div>

        <form onSubmit={submit} className="bg-card border border-black/5 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#5b5448] mb-1.5">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-ink/40"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5b5448] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-ink/40"
              placeholder="••••••••"
            />
          </div>

          {err && <p className="text-sm text-accent font-medium">{err}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-ink text-white text-sm font-semibold py-3 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-xs text-muted mt-4">
          Credentials are configured in the backend environment.
        </p>
      </div>
    </main>
  );
}
