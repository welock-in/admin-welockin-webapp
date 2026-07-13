"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LiveSession } from "@/lib/types";
import { apiGet, apiSend } from "@/lib/client";
import { fmtClock, timeAgo } from "@/lib/format";
import { Badge } from "@/components/ui";

const POLL_MS = 5000;

// Live remaining, extrapolated between the ~5-min heartbeats so the countdown
// still moves each second (the backend value is only refreshed on each beat).
function liveRemain(s: LiveSession): number {
  if (s.phase !== "running") return s.remainSeconds;
  const elapsed = (Date.now() - new Date(s.lastHeartbeatAt).getTime()) / 1000;
  return Math.max(0, Math.round(s.remainSeconds - elapsed));
}

export default function LiveSessions() {
  const [sessions, setSessions] = useState<LiveSession[] | null>(null);
  const [error, setError] = useState("");
  const [, tick] = useState(0);
  const [ending, setEnding] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ sessions: LiveSession[]; count: number }>("admin/live-sessions");
      setSessions(data.sessions);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
    timer.current = setInterval(load, POLL_MS);
    // Re-render every second for the smooth countdown.
    const sec = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      clearInterval(timer.current);
      clearInterval(sec);
    };
  }, [load]);

  async function forceEnd(id: string) {
    setEnding(id);
    try {
      await apiSend(`admin/live-sessions/${id}/force-end`, "POST");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setEnding(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <h2 className="text-sm font-bold text-ink">
            Live sessions {sessions ? `(${sessions.length})` : ""}
          </h2>
        </div>
        <span className="text-[11px] text-muted">auto-refresh 5s</span>
      </div>

      {error && <p className="text-sm text-accent mb-2">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-black/5">
              <th className="py-2 pr-3 font-semibold">User</th>
              <th className="py-2 pr-3 font-semibold">Session</th>
              <th className="py-2 pr-3 font-semibold">Device</th>
              <th className="py-2 pr-3 font-semibold">Remaining</th>
              <th className="py-2 pr-3 font-semibold">Beat</th>
              <th className="py-2 pr-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions === null && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {sessions && sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  No one is focusing right now.
                </td>
              </tr>
            )}
            {sessions?.map((s) => (
              <tr key={s.id} className="border-b border-black/[0.04] hover:bg-black/[0.015]">
                <td className="py-2.5 pr-3">
                  <Link href={`/users/${s.userId}`} className="font-medium text-ink hover:text-accent">
                    {s.user?.email ?? s.userId.slice(-6)}
                  </Link>
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-ink">{s.name}</span>
                    {s.hardLock && <Badge tone="red">hard</Badge>}
                    {s.phase === "break" && <Badge tone="amber">break</Badge>}
                    {s.forceEnd && <Badge tone="ink">ending…</Badge>}
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-muted">
                  {s.deviceName ?? s.platform ?? "—"}
                </td>
                <td className="py-2.5 pr-3 font-mono tabular-nums text-ink">{fmtClock(liveRemain(s))}</td>
                <td className="py-2.5 pr-3 text-muted">{timeAgo(s.lastHeartbeatAt)}</td>
                <td className="py-2.5 pr-3 text-right">
                  <button
                    onClick={() => forceEnd(s.id)}
                    disabled={s.forceEnd || ending === s.id}
                    className="rounded-lg border border-accent/30 text-accent text-xs font-semibold px-2.5 py-1 hover:bg-accent/5 disabled:opacity-50"
                  >
                    {ending === s.id ? "…" : s.forceEnd ? "Ending" : "Force end"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
