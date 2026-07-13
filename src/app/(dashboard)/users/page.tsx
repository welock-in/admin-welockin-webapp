"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UsersListResult } from "@/lib/types";
import { apiGet } from "@/lib/client";
import { fmtDuration, fmtDateShort, timeAgo, fmtNumber } from "@/lib/format";
import { Card, PageHeader, Badge } from "@/components/ui";

const TAKE = 25;

export default function UsersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "email">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<UsersListResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setSkip(0), [debounced, sortBy, sortDir]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        take: String(TAKE),
        skip: String(skip),
        sortBy,
        sortDir,
      });
      if (debounced) q.set("search", debounced);
      const res = await apiGet<UsersListResult>(`admin/users?${q.toString()}`);
      setData(res);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [skip, sortBy, sortDir, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const page = useMemo(() => Math.floor(skip / TAKE) + 1, [skip]);
  const pages = data ? Math.max(1, Math.ceil(data.total / TAKE)) : 1;

  function toggleSort(field: "createdAt" | "email") {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir(field === "email" ? "asc" : "desc");
    }
  }

  const arrow = (field: string) => (sortBy === field ? (sortDir === "asc" ? "▲" : "▼") : "");

  return (
    <div className="p-8">
      <PageHeader
        title="Profiles"
        subtitle={data ? `${fmtNumber(data.total)} accounts` : "All accounts"}
        right={
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="rounded-xl border border-black/10 bg-card px-3.5 py-2 text-sm outline-none focus:border-ink/40 w-64"
          />
        }
      />

      {error && <p className="text-sm text-accent mb-3">{error}</p>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-black/5 bg-black/[0.015]">
                <th className="py-3 px-4 font-semibold cursor-pointer select-none" onClick={() => toggleSort("email")}>
                  User {arrow("email")}
                </th>
                <th className="py-3 px-3 font-semibold">Plan</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold text-right">Sessions</th>
                <th className="py-3 px-3 font-semibold text-right">Focus</th>
                <th className="py-3 px-3 font-semibold text-right">Devices</th>
                <th className="py-3 px-3 font-semibold">Last active</th>
                <th className="py-3 px-4 font-semibold cursor-pointer select-none" onClick={() => toggleSort("createdAt")}>
                  Joined {arrow("createdAt")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {data && data.users.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    No users found.
                  </td>
                </tr>
              )}
              {data?.users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => router.push(`/users/${u.id}`)}
                  className="border-b border-black/[0.04] hover:bg-black/[0.02] cursor-pointer"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {u.liveNow && (
                        <span className="relative flex h-2 w-2" title="Live now">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      )}
                      <span className="font-medium text-ink">{u.email}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 capitalize text-muted">{u.plan}</td>
                  <td className="py-3 px-3">
                    {u.status === "suspended" ? <Badge tone="red">suspended</Badge> : <Badge tone="green">active</Badge>}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-ink">{fmtNumber(u.sessionCount)}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-ink">{fmtDuration(u.totalFocusSeconds)}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-muted">{u.deviceCount}</td>
                  <td className="py-3 px-3 text-muted">{u.lastActiveAt ? timeAgo(u.lastActiveAt) : "—"}</td>
                  <td className="py-3 px-4 text-muted">{fmtDateShort(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.total > TAKE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-black/5 text-sm">
            <span className="text-muted">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSkip((s) => Math.max(0, s - TAKE))}
                disabled={skip === 0}
                className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40 hover:bg-black/[0.03]"
              >
                Prev
              </button>
              <button
                onClick={() => setSkip((s) => (s + TAKE < data.total ? s + TAKE : s))}
                disabled={skip + TAKE >= data.total}
                className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40 hover:bg-black/[0.03]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
