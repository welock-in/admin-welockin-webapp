"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FunnelResult, FunnelRun } from "@/lib/types";
import { apiGet } from "@/lib/client";
import { fmtDuration, pct, timeAgo } from "@/lib/format";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui";

type PlatformFilter = "" | "windows" | "macos";

const PLATFORM_TABS: { value: PlatformFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
];

const WINDOW_CHOICES = [7, 14, 30];

const pill = (active: boolean) =>
  `px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
    active ? "bg-ink text-white" : "text-muted hover:text-ink"
  }`;

/** Per-step / per-run ms: sub-second gets a decimal ("0.4s"), else fmtDuration. */
function fmtMs(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "—";
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
  return fmtDuration(Math.round(ms / 1000));
}

/** `10:54:07` — UTC getters, same determinism rule as fmtDate (no locale APIs). */
function fmtClockUtc(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function platformLabel(p: string): string {
  return p === "windows" ? "Windows" : p === "macos" ? "macOS" : p;
}

/**
 * The address, on the card. This page is where a signup is chased, and chasing
 * it used to mean a trip to the users page and a guess about which account the
 * machine turned into — so the email lives here, one click from the clipboard.
 */
function EmailRow({ run }: { run: FunnelRun }) {
  const [copied, setCopied] = useState(false);

  if (!run.email) {
    return (
      <p className="mt-1.5">
        <Badge>no email yet</Badge>
      </p>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(run.email!);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard is permission-gated and absent over plain http. The address
      // is on screen and selectable either way, so a failure is silent.
    }
  };

  return (
    // The address WRAPS rather than truncates: reading it here instead of
    // opening the profile is the whole point, and three cards to a row is not
    // enough width for a long student address on one line.
    <div className="mt-1.5 flex items-start gap-1.5 min-w-0">
      {run.userId ? (
        <Link
          href={`/users/${run.userId}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium text-ink hover:text-accent break-all min-w-0"
        >
          {run.email}
        </Link>
      ) : (
        <span className="text-sm font-medium text-ink break-all min-w-0">{run.email}</span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          void copy();
        }}
        title="Copy the address"
        aria-label={`Copy ${run.email}`}
        className="flex-none text-muted hover:text-ink transition p-0.5 mt-0.5"
      >
        {copied ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
      {/* An older account on the same machine is a guess, not this walk's
          signup — say so, or the wrong person gets the email. */}
      {run.emailMatch === "device" && (
        <span
          className="flex-none text-[11px] text-muted mt-1"
          title="Matched on the machine, not on this walk: the account is older than the run (a reinstall, or a second walk). Check before writing."
        >
          same machine
        </span>
      )}
    </div>
  );
}

export default function FunnelPage() {
  const [platform, setPlatform] = useState<PlatformFilter>("");
  const [days, setDays] = useState(14);
  const [data, setData] = useState<FunnelResult | null>(null);
  const [withEmail, setWithEmail] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    // Effect-scoped liveness (same pattern as Shell's dead-letter poll): a
    // filter change re-runs the effect, and a slow response from the OLD
    // filter must not land over the new one's data — nor a stale rejection
    // over a fresh success, nor either after unmount.
    let alive = true;
    const load = async () => {
      try {
        const q = new URLSearchParams({ days: String(days), take: "200" });
        if (platform) q.set("platform", platform);
        const result = await apiGet<FunnelResult>(`admin/funnel?${q}`);
        if (!alive) return;
        setData(result);
        setError("");
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    };
    void load();
    const iv = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [platform, days]);

  const s = data?.summary;
  const runs = data?.runs ?? [];
  const emailed = runs.filter((r) => r.email !== null);
  const shown = withEmail ? emailed : runs;

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="Funnel"
        subtitle="Every signup walk, step by step, machine by machine."
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1">
              {PLATFORM_TABS.map((p) => (
                <button key={p.value || "all"} onClick={() => setPlatform(p.value)} className={pill(platform === p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1">
              {WINDOW_CHOICES.map((d) => (
                <button key={d} onClick={() => setDays(d)} className={pill(days === d)}>
                  {d}d
                </button>
              ))}
            </div>
            {/* Not a server filter: the stat cards and the drop-off chart stay
                the whole window's, so the numbers above never quietly change
                meaning. Only the run list narrows. */}
            <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1">
              <button
                onClick={() => setWithEmail((v) => !v)}
                aria-pressed={withEmail}
                className={pill(withEmail)}
              >
                With email
              </button>
            </div>
          </div>
        }
      />

      {error && <p className="text-sm text-accent mb-4">{error}</p>}
      {!data && !error && <p className="text-sm text-muted">Loading…</p>}

      {data && s && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Started" value={s.started} />
            <StatCard
              label="Completed"
              value={s.completed}
              sub={s.started > 0 ? `${pct(s.completed / s.started)} completion` : "—"}
            />
            <StatCard label="Active now" value={s.active} accent={s.active > 0} sub="seen in the last 10 min" />
            <StatCard label="Median time" value={fmtMs(s.medianDurationMs)} />
          </div>

          <Card className="p-5">
            <h2 className="text-sm font-bold text-ink mb-3">Drop-off by step</h2>
            {s.dropoff.length === 0 ? (
              <p className="text-sm text-muted">No steps recorded in this window.</p>
            ) : (
              <div className="space-y-2">
                {s.dropoff.map((row) => (
                  <div key={row.step} className="flex items-center gap-3">
                    <span className="w-28 flex-none text-sm font-medium text-ink capitalize truncate" title={row.step}>
                      {row.step}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-black/5 overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${s.started > 0 ? Math.min(100, (row.reached / s.started) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="w-12 flex-none text-right text-sm tabular-nums text-ink">{row.reached}</span>
                    <span className="w-10 flex-none text-right text-xs font-semibold tabular-nums text-red-600">
                      {row.droppedHere > 0 ? `-${row.droppedHere}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-ink">
                Runs{" "}
                {runs.length > 0 && (
                  <span className="font-medium text-muted">
                    {withEmail ? `(${emailed.length} of ${runs.length} with an email)` : `(${runs.length}, ${emailed.length} with an email)`}
                  </span>
                )}
              </h2>
              <span className="text-[11px] text-muted">auto-refresh 10s</span>
            </div>
            {shown.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted">
                {runs.length === 0
                  ? "No funnel runs in this window yet."
                  : "No run in this window left an email."}
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">
                {shown.map((run) => (
                  <RunCard
                    key={run.runId}
                    run={run}
                    open={expanded === run.runId}
                    onToggle={() => setExpanded((cur) => (cur === run.runId ? null : run.runId))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: FunnelRun["status"] }) {
  if (status === "completed") return <Badge tone="green">completed</Badge>;
  if (status === "active")
    return (
      <Badge tone="amber">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600" />
        </span>
        active
      </Badge>
    );
  return <Badge tone="red">abandoned</Badge>;
}

function RunCard({ run, open, onToggle }: { run: FunnelRun; open: boolean; onToggle: () => void }) {
  const meta = [
    platformLabel(run.platform),
    run.osVersion,
    run.appVersion ? `app v${run.appVersion}` : null,
    run.locale,
  ]
    .filter(Boolean)
    .join(" · ");

  const stepsLogged = run.steps.length;
  const progressPct =
    run.screenTotal && run.screenTotal > 0 ? Math.min(100, (stepsLogged / run.screenTotal) * 100) : 0;

  const footnote = [
    // funnelVersion is already a full tag ("desktop_v2") — no "v" prefix.
    run.funnelVersion ? `funnel ${run.funnelVersion}` : null,
    run.withAccount == null ? null : run.withAccount ? "with account" : "no account",
  ]
    .filter(Boolean)
    .join(" · ");

  // The card used to be ONE big <button>. It cannot be any more: the email row
  // holds a link and a copy button, and an <a>/<button> inside a <button> is
  // invalid HTML — the parser closes the outer one early and the card breaks.
  // So the chevron is the real, labelled toggle, and the inert blocks around it
  // stay click-to-expand for the mouse.
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div onClick={onToggle} className="flex items-center gap-2 flex-wrap cursor-pointer">
            <span className="font-semibold text-ink truncate min-w-0">{run.deviceName ?? "Unknown device"}</span>
            <StatusBadge status={run.status} />
          </div>
          <EmailRow run={run} />
        </div>
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? "Hide the steps" : "Show the steps"}
          className="flex-none mt-1 text-muted hover:text-ink transition"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      <div onClick={onToggle} className="cursor-pointer">
        <p className="text-xs text-muted mt-1">{meta || "—"}</p>
        <p className="text-xs text-muted mt-2">
          started {timeAgo(run.startedAt)} · {fmtMs(run.durationMs)}
          {run.lastStep && (
            <>
              {" · last step "}
              <span className="text-ink font-medium capitalize">{run.lastStep}</span>
            </>
          )}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="flex-none text-[11px] text-muted tabular-nums">
            {run.screenTotal ? `${stepsLogged}/${run.screenTotal}` : stepsLogged} steps
          </span>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-3 border-t border-black/5">
          {run.steps.length === 0 ? (
            <p className="text-sm text-muted">No steps logged.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-black/5">
                  <th className="py-1.5 pr-3 font-semibold">Step</th>
                  <th className="py-1.5 pr-3 font-semibold">Entered</th>
                  <th className="py-1.5 font-semibold text-right">Time on step</th>
                </tr>
              </thead>
              <tbody>
                {run.steps.map((st, i) => (
                  <tr key={`${st.step}-${i}`} className="border-b border-black/[0.04] last:border-0">
                    <td className="py-1.5 pr-3 capitalize text-ink">{st.step}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs text-muted">{fmtClockUtc(st.enteredAt)}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {/* An open entry only means "live" while the RUN is live —
                          an abandoned run also ends on one (the screen the user
                          quit from), and that must read as silence, not activity. */}
                      {run.status === "active" && st.enteredAt && !st.leftAt ? (
                        <span className="text-amber-600 text-xs font-semibold">in progress…</span>
                      ) : (
                        fmtMs(st.ms)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {footnote && <p className="text-[11px] text-muted mt-2">{footnote}</p>}
        </div>
      )}
    </Card>
  );
}
