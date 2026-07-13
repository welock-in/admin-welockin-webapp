"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";

const PLANS = ["trial", "free", "pro", "lifetime"];

export default function UserModeration({
  userId,
  status,
  plan,
  email,
}: {
  userId: string;
  status: string;
  plan: string;
  email: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [planValue, setPlanValue] = useState(plan);
  const [error, setError] = useState("");

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const suspended = status === "suspended";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {suspended ? (
        <button
          onClick={() => run("unsuspend", () => apiSend(`admin/users/${userId}/unsuspend`, "POST"))}
          disabled={!!busy}
          className="rounded-xl border border-emerald-500/40 text-emerald-700 text-sm font-semibold px-3.5 py-2 hover:bg-emerald-50 disabled:opacity-50"
        >
          {busy === "unsuspend" ? "…" : "Unsuspend"}
        </button>
      ) : (
        <button
          onClick={() => run("suspend", () => apiSend(`admin/users/${userId}/suspend`, "POST"))}
          disabled={!!busy}
          className="rounded-xl border border-amber-500/40 text-amber-700 text-sm font-semibold px-3.5 py-2 hover:bg-amber-50 disabled:opacity-50"
        >
          {busy === "suspend" ? "…" : "Suspend"}
        </button>
      )}

      <div className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-card pl-2 pr-1.5 py-1">
        <select
          value={planValue}
          onChange={(e) => setPlanValue(e.target.value)}
          className="text-sm bg-transparent outline-none capitalize"
        >
          {[...new Set([plan, ...PLANS])].map((p) => (
            <option key={p} value={p} className="capitalize">
              {p}
            </option>
          ))}
        </select>
        <button
          onClick={() => run("plan", () => apiSend(`admin/users/${userId}/plan`, "POST", { plan: planValue }))}
          disabled={!!busy || planValue === plan}
          className="rounded-lg bg-ink text-white text-xs font-semibold px-2.5 py-1.5 disabled:opacity-40"
        >
          {busy === "plan" ? "…" : "Set plan"}
        </button>
      </div>

      <button
        onClick={() => {
          if (confirm(`Permanently delete ${email}? This removes their account, devices, sessions and history. This cannot be undone.`)) {
            void run("delete", async () => {
              await apiSend(`admin/users/${userId}`, "DELETE");
              router.push("/users");
            });
          }
        }}
        disabled={!!busy}
        className="rounded-xl border border-accent/40 text-accent text-sm font-semibold px-3.5 py-2 hover:bg-accent/5 disabled:opacity-50"
      >
        {busy === "delete" ? "…" : "Delete"}
      </button>

      {error && <span className="text-sm text-accent">{error}</span>}
    </div>
  );
}
