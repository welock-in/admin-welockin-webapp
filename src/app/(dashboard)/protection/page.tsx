"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProtectionEntry, ProtectionListResult, ProtectionLock } from "@/lib/types";
import { apiGet, apiSend } from "@/lib/client";
import { fmtDate, fmtNumber, timeAgo } from "@/lib/format";
import { Card, PageHeader, Badge } from "@/components/ui";

type Tab = "list" | "active";

export default function ProtectionPage() {
  const [tab, setTab] = useState<Tab>("list");
  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="Addiction protection"
        subtitle="Curated blocklist (global) + accounts with protection on."
        right={
          <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1">
            {(["list", "active"] as Tab[]).map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
                  tab === tb ? "bg-ink text-white" : "text-muted hover:text-ink"
                }`}
              >
                {tb === "list" ? "Blocklist" : "Active protection"}
              </button>
            ))}
          </div>
        }
      />
      {tab === "list" ? <BlocklistTab /> : <ActiveTab />}
    </div>
  );
}

// ── Blocklist tab ─────────────────────────────────────────────────────────────

function BlocklistTab() {
  const [data, setData] = useState<ProtectionListResult | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kindFilter, setKindFilter] = useState<"" | "site" | "app">("");

  // Add form
  const [category, setCategory] = useState("explicit");
  const [kind, setKind] = useState<"site" | "app">("site");
  const [value, setValue] = useState("");
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ take: "500" });
      if (debounced) q.set("search", debounced);
      if (kindFilter) q.set("kind", kindFilter);
      setData(await apiGet<ProtectionListResult>(`admin/addiction-protection?${q}`));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [debounced, kindFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const g: Record<string, number> = {};
    for (const e of data?.entries ?? []) g[e.category] = (g[e.category] ?? 0) + 1;
    return g;
  }, [data]);

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setNote("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  async function addOne() {
    if (!value.trim() || !category.trim()) return;
    await run("add", async () => {
      await apiSend("admin/addiction-protection", "POST", { category: category.trim(), kind, value: value.trim() });
      setValue("");
    });
  }

  async function importBulk() {
    const values = bulk.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
    if (!values.length || !category.trim()) return;
    await run("import", async () => {
      const r = await apiSend<{ added: number; updated: number; submitted: number }>(
        "admin/addiction-protection/import",
        "POST",
        { category: category.trim(), kind, values },
      );
      setBulk("");
      setNote(`Imported: ${r.added} added, ${r.updated} updated (of ${r.submitted}).`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Add / import */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Category">
            <input list="prot-cats" value={category} onChange={(e) => setCategory(e.target.value)} className={inp} placeholder="explicit" />
            <datalist id="prot-cats">
              {Object.keys(grouped).map((c) => (
                <option key={c} value={c} />
              ))}
              <option value="explicit" />
              <option value="gambling" />
            </datalist>
          </Field>
          <Field label="Type">
            <select value={kind} onChange={(e) => setKind(e.target.value as "site" | "app")} className={inp}>
              <option value="site">site</option>
              <option value="app">app</option>
            </select>
          </Field>
          <Field label="Value" grow>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addOne()}
              className={inp}
              placeholder={kind === "site" ? "pornhub.com" : "someapp.exe"}
            />
          </Field>
          <button onClick={addOne} disabled={busy === "add"} className="rounded-xl bg-ink text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50">
            {busy === "add" ? "…" : "Add"}
          </button>
        </div>
        <details className="mt-3">
          <summary className="text-sm text-muted cursor-pointer select-none">Bulk import (one value per line — uses the Category + Type above)</summary>
          <div className="mt-2 flex gap-3 items-end">
            <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={4} className={`${inp} font-mono text-xs w-full`} placeholder={"site1.com\nsite2.com"} />
            <button onClick={importBulk} disabled={busy === "import"} className="rounded-xl border border-ink/20 text-ink text-sm font-semibold px-4 py-2.5 disabled:opacity-50 whitespace-nowrap">
              {busy === "import" ? "…" : "Import"}
            </button>
          </div>
        </details>
        {note && <p className="text-sm text-emerald-700 mt-2">{note}</p>}
      </Card>

      {/* Filters + table */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-black/5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search value…" className={`${inp} w-64`} />
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "" | "site" | "app")} className={inp}>
            <option value="">All types</option>
            <option value="site">Sites</option>
            <option value="app">Apps</option>
          </select>
          <div className="flex-1" />
          <span className="text-sm text-muted">{data ? `${fmtNumber(data.total)} entries` : ""}</span>
        </div>
        {error && <p className="text-sm text-accent px-4 py-2">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-black/5 bg-black/[0.015]">
                <th className="py-2.5 px-4 font-semibold">Category</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Value</th>
                <th className="py-2.5 px-3 font-semibold">Platform</th>
                <th className="py-2.5 px-3 font-semibold">Source</th>
                <th className="py-2.5 px-3 font-semibold">Active</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data && data.entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">No entries.</td>
                </tr>
              )}
              {data?.entries.map((e: ProtectionEntry) => (
                <tr key={e.id} className="border-b border-black/[0.04]">
                  <td className="py-2.5 px-4 capitalize">{e.category}</td>
                  <td className="py-2.5 px-3 text-muted">{e.kind}</td>
                  <td className="py-2.5 px-3 font-mono text-ink">{e.value}</td>
                  <td className="py-2.5 px-3 text-muted">{e.platform ?? "all"}</td>
                  <td className="py-2.5 px-3">{e.source === "seed" ? <Badge tone="gray">seed</Badge> : <Badge tone="ink">admin</Badge>}</td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => run(e.id, () => apiSend(`admin/addiction-protection/${e.id}`, "PATCH", { active: !e.active }))}
                      disabled={busy === e.id}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${e.active ? "bg-emerald-100 text-emerald-700" : "bg-black/5 text-muted"}`}
                    >
                      {e.active ? "active" : "off"}
                    </button>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${e.value}?`)) void run(e.id, () => apiSend(`admin/addiction-protection/${e.id}`, "DELETE"));
                      }}
                      disabled={busy === e.id}
                      className="text-accent text-xs font-semibold hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Active protection tab ─────────────────────────────────────────────────────

function ActiveTab() {
  const [locks, setLocks] = useState<ProtectionLock[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ locks: ProtectionLock[]; count: number }>("admin/addiction-protection/active");
      setLocks(r.locks);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  async function disable(id: string, email: string) {
    if (!confirm(`Turn OFF protection for ${email}? (admin override)`)) return;
    setBusy(id);
    try {
      await apiSend(`admin/addiction-protection/active/${id}/disable`, "POST");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
        <h2 className="text-sm font-bold text-ink">Accounts with protection on {locks ? `(${locks.length})` : ""}</h2>
        <span className="text-[11px] text-muted">auto-refresh 10s</span>
      </div>
      {error && <p className="text-sm text-accent px-4 py-2">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-black/5 bg-black/[0.015]">
              <th className="py-2.5 px-4 font-semibold">User</th>
              <th className="py-2.5 px-3 font-semibold">Method</th>
              <th className="py-2.5 px-3 font-semibold">Categories</th>
              <th className="py-2.5 px-3 font-semibold">OTP / Until</th>
              <th className="py-2.5 px-3 font-semibold">Since</th>
              <th className="py-2.5 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {locks && locks.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">No accounts have protection on.</td>
              </tr>
            )}
            {locks?.map((l) => (
              <tr key={l.id} className="border-b border-black/[0.04]">
                <td className="py-2.5 px-4 font-medium text-ink">{l.user?.email ?? l.userId.slice(-6)}</td>
                <td className="py-2.5 px-3">
                  {l.method === "partner" ? <Badge tone="ink">partner</Badge> : <Badge tone="amber">dated</Badge>}
                </td>
                <td className="py-2.5 px-3 text-muted">{l.categories.join(", ") || "—"}</td>
                <td className="py-2.5 px-3">
                  {l.method === "partner" ? (
                    l.otp ? <span className="font-mono font-bold tracking-widest text-ink">{l.otp}</span> : <span className="text-muted">—</span>
                  ) : (
                    <span className="text-ink">{fmtDate(l.lockedUntil)}</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-muted">{timeAgo(l.updatedAt)}</td>
                <td className="py-2.5 px-4 text-right">
                  <button
                    onClick={() => disable(l.id, l.user?.email ?? "this account")}
                    disabled={busy === l.id}
                    className="rounded-lg border border-accent/30 text-accent text-xs font-semibold px-2.5 py-1 hover:bg-accent/5 disabled:opacity-50"
                  >
                    {busy === l.id ? "…" : "Disable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const inp = "rounded-xl border border-black/10 bg-card px-3 py-2 text-sm outline-none focus:border-ink/40";

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${grow ? "flex-1 min-w-[180px]" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}
