"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fmtDate, timeAgo } from "@/lib/format";
import { Badge, Card } from "@/components/ui";
import type { BillingTask, BillingTasksResult, DrainReport } from "@/lib/types";

/**
 * The cancellation outbox — every billing action still owed to Lemon Squeezy.
 *
 * The split the backend sends is the point of the page: a PENDING task is
 * being retried on its own and needs nothing; a DEAD-LETTERED one (maxAttempts
 * exhausted, still not settled) is no longer retried automatically, which
 * means a customer whose card may still be charged and whose cancellation
 * nothing will ever send — unless an operator sees it here and replays it once
 * the cause (an expired API key, a refused subscription) is fixed.
 */
export default function BillingTasks() {
  const [data, setData] = useState<BillingTasksResult | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await apiGet<BillingTasksResult>("admin/billing-tasks"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  async function run(id: string, fn: () => Promise<string>) {
    setBusy(id);
    setNote("");
    setError("");
    try {
      setNote(await fn());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  const drain = () =>
    run("drain", async () => {
      const r = await apiSend<DrainReport>("admin/billing-tasks/drain", "POST");
      return (
        `Drained: ${r.due} due, ${r.settled} settled, ${r.contended} contended — ` +
        `${r.stillOwed} still owed (${r.deadLettered} dead-lettered).`
      );
    });

  const replay = (t: BillingTask) =>
    run(t.id, async () => {
      const r = await apiSend<{ requeued: boolean }>(`admin/billing-tasks/${t.id}/replay`, "POST");
      return r.requeued
        ? `Replayed — ${t.externalId} is back in the queue and will be retried now.`
        : `Nothing to replay — ${t.externalId} is already settled.`;
    });

  const rows: { task: BillingTask; dead: boolean }[] = data
    ? [
        ...data.deadLetter.map((task) => ({ task, dead: true })),
        ...data.pending.map((task) => ({ task, dead: false })),
      ]
    : [];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap px-4 py-3 border-b border-black/5">
        <h2 className="text-sm font-bold text-ink">
          Owed to the provider {data ? `(${data.owed})` : ""}
        </h2>
        {data && data.deadLetter.length > 0 && (
          <Badge tone="red">{data.deadLetter.length} dead-lettered</Badge>
        )}
        <div className="flex-1" />
        <span className="text-[11px] text-muted">auto-refresh 30s</span>
        <button
          onClick={drain}
          disabled={!!busy}
          title="Run the queue now instead of waiting for the next cron tick. Safe to press twice."
          className="rounded-xl bg-ink text-white text-sm font-semibold px-3.5 py-2 disabled:opacity-50"
        >
          {busy === "drain" ? "…" : "Drain now"}
        </button>
      </div>

      {error && <p className="text-sm text-accent px-4 py-2">{error}</p>}
      {note && <p className="text-sm text-emerald-700 px-4 py-2">{note}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-black/5 bg-black/[0.015]">
              <th className="py-2.5 px-4 font-semibold">Subscription</th>
              <th className="py-2.5 px-3 font-semibold">Kind · reason</th>
              <th className="py-2.5 px-3 font-semibold text-right">Attempts</th>
              <th className="py-2.5 px-3 font-semibold">Last error</th>
              <th className="py-2.5 px-3 font-semibold">Next attempt</th>
              <th className="py-2.5 px-3 font-semibold">Created</th>
              <th className="py-2.5 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {data && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted">
                  No pending billing tasks.
                </td>
              </tr>
            )}
            {rows.map(({ task: t, dead }) => (
              <tr
                key={t.id}
                className={`border-b border-black/[0.04] ${dead ? "bg-red-50" : ""}`}
              >
                <td className="py-2.5 px-4 font-mono text-ink">{t.externalId}</td>
                <td className="py-2.5 px-3 text-muted">
                  {t.kind} · {t.reason}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  <span className={dead ? "font-semibold text-red-700" : "text-ink"}>
                    {t.attempts}
                  </span>
                  <span className="text-muted"> / {data?.maxAttempts ?? "—"}</span>
                </td>
                <td className="py-2.5 px-3 text-muted max-w-[220px] truncate" title={t.lastError ?? undefined}>
                  {t.lastError ?? "—"}
                </td>
                <td className="py-2.5 px-3">
                  {dead ? (
                    <Badge tone="red">dead-lettered — replay only</Badge>
                  ) : (
                    <span className="text-ink">{fmtDate(t.nextAttemptAt)}</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-muted" title={fmtDate(t.createdAt)}>
                  {timeAgo(t.createdAt)}
                </td>
                <td className="py-2.5 px-4 text-right">
                  {dead && (
                    <button
                      onClick={() => replay(t)}
                      disabled={!!busy}
                      title="Put it back in the queue — do this once the cause of the failures is fixed"
                      className="rounded-lg border border-accent/40 text-accent text-xs font-semibold px-2.5 py-1 hover:bg-accent/5 disabled:opacity-40"
                    >
                      {busy === t.id ? "…" : "Replay"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="px-4 py-3 text-xs text-muted leading-relaxed border-t border-black/5">
        These are cancellations the backend still owes Lemon Squeezy (from account deletions and
        lifetime upgrades). Pending rows retry on their own with backoff; a{" "}
        <span className="text-red-700 font-semibold">dead-lettered</span> row has exhausted its
        attempts and is only retried when you press Replay — until then the customer may still be
        being charged. Drain and Replay are safe to repeat: cancelling an already-cancelled
        subscription is a no-op.
      </p>
    </Card>
  );
}
