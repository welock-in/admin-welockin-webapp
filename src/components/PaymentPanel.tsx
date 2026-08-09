"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import type { AdminUser, AdminPurchase, AdminSubscription } from "@/lib/types";

/**
 * Everything an operator can do to an account's PAYMENT state, in one place:
 * see what they actually paid for, grant access without a payment (comp), take
 * it away (revoke), give a machine its trial back, and cancel a live
 * subscription. Every write goes to an audited backend route with a reason.
 */
export default function PaymentPanel({
  user,
  purchases,
  subscriptions,
  testTools = false,
}: {
  user: AdminUser;
  purchases: AdminPurchase[];
  subscriptions: AdminSubscription[];
  /** Whether the backend allows the synthetic-subscription test lab (test mode). */
  testTools?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  // Test-lab "conjure a subscription" form.
  const [labStatus, setLabStatus] = useState("active");
  const [labInterval, setLabInterval] = useState("monthly");
  const [labDays, setLabDays] = useState("14");

  async function run(action: string, fn: () => Promise<unknown>, needsReason = true) {
    if (needsReason && reason.trim().length < 3) {
      setError("A reason (3+ characters) is required — it lands in the audit log.");
      return;
    }
    setBusy(action);
    setError("");
    setOk("");
    try {
      await fn();
      setOk("Done.");
      setReason("");
      setUntil("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const uid = user.id;
  const compActive = user.compActive === true;
  const revoked = user.accessRevoked === true;

  const grantsNow = (s: AdminSubscription) => {
    const live = ["on_trial", "active", "paused", "past_due", "cancelled"].includes(s.status);
    const notEnded = !s.endsAt || new Date(s.endsAt).getTime() > Date.now();
    return live && notEnded;
  };

  // A synthetic test-lab row (never touches Lemon Squeezy) vs a real one.
  const isSim = (s: AdminSubscription) => s.testMode === true && s.externalId.startsWith("sim_");

  /** Move a subscription to a lifecycle state — real LS op when the row is real. */
  const transition = (s: AdminSubscription, to: string) =>
    apiSend(`admin/users/${uid}/subscription-transition`, "POST", {
      reason,
      externalId: s.externalId,
      to,
    });

  /** Set how long it has left, in days AND hours. */
  const setTime = (s: AdminSubscription, days: number, hours: number) =>
    apiSend(`admin/users/${uid}/subscription-time`, "POST", {
      reason,
      externalId: s.externalId,
      days,
      hours,
    });

  return (
    <div className="rounded-2xl border border-black/10 bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-ink">Payments &amp; entitlement</h2>
        <div className="flex items-center gap-1.5">
          <Badge tone={user.isProCached ? "green" : "gray"}>
            {user.entitlementStatus ?? "—"}
          </Badge>
          {compActive && <Badge tone="ink">comped</Badge>}
          {revoked && <Badge tone="red">revoked</Badge>}
        </div>
      </div>

      {/* What they actually paid for — the real record, not the cache. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
            Purchases ({purchases.length})
          </div>
          {purchases.length === 0 ? (
            <p className="text-sm text-muted">No one-off purchases.</p>
          ) : (
            <div className="space-y-2">
              {purchases.map((p) => (
                <div key={p.id} className="text-sm border-b border-black/[0.04] pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">
                      {p.priceUsd != null ? `€${p.priceUsd.toFixed(2)}` : "—"}
                    </span>
                    {p.isRefunded && <Badge tone="red">refunded</Badge>}
                    {p.testMode && <Badge tone="amber">test</Badge>}
                  </div>
                  <div className="text-xs text-muted">
                    {fmtDate(p.purchasedAt)} · order {p.externalId} · {p.provider}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
            Subscriptions ({subscriptions.length})
          </div>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted">No subscriptions.</p>
          ) : (
            <div className="space-y-2">
              {subscriptions.map((s) => (
                <div key={s.id} className="text-sm border-b border-black/[0.04] pb-2 last:border-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink capitalize">{s.interval ?? "sub"}</span>
                    <Badge tone={grantsNow(s) ? "green" : "gray"}>{s.status}</Badge>
                    {isSim(s) ? (
                      <Badge tone="ink">sim</Badge>
                    ) : (
                      s.testMode && <Badge tone="amber">test</Badge>
                    )}

                    {/* Real subscriptions: auto-renewal off (cancel) / on (resume). */}
                    {!isSim(s) && grantsNow(s) && s.status !== "cancelled" && (
                      <button
                        onClick={() =>
                          run("cancel:" + s.id, () =>
                            apiSend(`admin/users/${uid}/cancel-subscription`, "POST", {
                              reason,
                              externalId: s.externalId,
                            }),
                          )
                        }
                        disabled={!!busy}
                        className="ml-auto rounded-lg border border-accent/40 text-accent text-xs font-semibold px-2.5 py-1 hover:bg-accent/5 disabled:opacity-40"
                      >
                        {busy === "cancel:" + s.id ? "…" : "Auto-renew off"}
                      </button>
                    )}
                    {!isSim(s) && grantsNow(s) && s.status === "cancelled" && (
                      <button
                        onClick={() =>
                          run("resume:" + s.id, () =>
                            apiSend(`admin/users/${uid}/reactivate-subscription`, "POST", {
                              reason,
                              externalId: s.externalId,
                            }),
                          )
                        }
                        disabled={!!busy}
                        className="ml-auto rounded-lg border border-emerald-500/40 text-emerald-700 text-xs font-semibold px-2.5 py-1 hover:bg-emerald-50 disabled:opacity-40"
                      >
                        {busy === "resume:" + s.id ? "…" : "Auto-renew on"}
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {s.renewsAt && s.status !== "cancelled"
                      ? `renews ${fmtDate(s.renewsAt)}`
                      : s.endsAt
                        ? `ends ${fmtDate(s.endsAt)}`
                        : s.trialEndsAt
                          ? `trial until ${fmtDate(s.trialEndsAt)}`
                          : "—"}{" "}
                    · sub {s.externalId}
                  </div>

                  {/* Lifecycle controls — on ANY row, real or synthetic. On a
                      real one these are genuine Lemon Squeezy operations (the
                      response says which), so the whole chain gets tested. */}
                  {testTools && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wide text-muted mr-0.5">Move to</span>
                        <button
                          onClick={() => run("to-active:" + s.id, () => transition(s, "active"))}
                          disabled={!!busy}
                          className="rounded-lg border border-emerald-500/40 text-emerald-700 text-xs font-semibold px-2 py-1 hover:bg-emerald-50 disabled:opacity-40"
                          title="A trial converts now (charges the card on file); a cancelled one resumes"
                        >
                          Pro (active)
                        </button>
                        <button
                          onClick={() => run("to-cancelled:" + s.id, () => transition(s, "cancelled"))}
                          disabled={!!busy}
                          className="rounded-lg border border-accent/40 text-accent text-xs font-semibold px-2 py-1 hover:bg-accent/5 disabled:opacity-40"
                          title="Real cancel. Cancelling a running trial ends access immediately."
                        >
                          Cancelled
                        </button>
                        <button
                          onClick={() => run("to-expired:" + s.id, () => transition(s, "expired"))}
                          disabled={!!busy}
                          className="rounded-lg border border-amber-500/40 text-amber-700 text-xs font-semibold px-2 py-1 hover:bg-amber-50 disabled:opacity-40"
                          title="Local write — Lemon Squeezy has no 'end it now'"
                        >
                          Expired
                        </button>
                        {isSim(s) && (
                          <button
                            onClick={() => run("simdel:" + s.id, () => apiSend(`admin/users/${uid}/test-subscription/${s.id}`, "DELETE", { reason }))}
                            disabled={!!busy}
                            className="rounded-lg border border-black/15 text-ink text-xs font-semibold px-2 py-1 hover:bg-black/5 disabled:opacity-40"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      <TimeLeft
                        s={s}
                        busy={!!busy}
                        onApply={(d, h) => run("time:" + s.id, () => setTime(s, d, h))}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reason — shared by every write below (mandatory, audited). */}
      <div className="rounded-xl bg-bg border border-black/10 p-3 mb-3">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
          Reason (audited)
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. support goodwill after a botched reinstall"
          className="w-full h-10 px-3 rounded-lg border border-black/10 bg-card text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      {/* Grant without a payment. */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          onClick={() =>
            run("comp-life", () => apiSend(`admin/users/${uid}/comp`, "POST", { reason }))
          }
          disabled={!!busy}
          className="rounded-xl bg-ink text-white text-sm font-semibold px-3.5 py-2 disabled:opacity-50"
        >
          {busy === "comp-life" ? "…" : "Grant lifetime (comp)"}
        </button>

        <div className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-card pl-2 pr-1.5 py-1">
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="text-sm bg-transparent outline-none"
          />
          <button
            onClick={() =>
              run("comp-until", () =>
                apiSend(`admin/users/${uid}/comp`, "POST", {
                  reason,
                  until: until ? new Date(until).toISOString() : undefined,
                }),
              )
            }
            disabled={!!busy || !until}
            className="rounded-lg bg-ink text-white text-xs font-semibold px-2.5 py-1.5 disabled:opacity-40"
          >
            {busy === "comp-until" ? "…" : "Comp until date"}
          </button>
        </div>

        {compActive && (
          <button
            onClick={() =>
              run("comp-off", () => apiSend(`admin/users/${uid}/comp`, "DELETE", { reason }))
            }
            disabled={!!busy}
            className="rounded-xl border border-black/15 text-ink text-sm font-semibold px-3.5 py-2 hover:bg-black/5 disabled:opacity-50"
          >
            {busy === "comp-off" ? "…" : "Withdraw comp"}
          </button>
        )}
      </div>

      {/* Take it away / recourse. */}
      <div className="flex flex-wrap items-center gap-2">
        {revoked ? (
          <button
            onClick={() =>
              run("unrevoke", () => apiSend(`admin/users/${uid}/revoke`, "DELETE", { reason }))
            }
            disabled={!!busy}
            className="rounded-xl border border-emerald-500/40 text-emerald-700 text-sm font-semibold px-3.5 py-2 hover:bg-emerald-50 disabled:opacity-50"
          >
            {busy === "unrevoke" ? "…" : "Un-revoke access"}
          </button>
        ) : (
          <button
            onClick={() =>
              run("revoke", () => apiSend(`admin/users/${uid}/revoke`, "POST", { reason }))
            }
            disabled={!!busy}
            className="rounded-xl border border-accent/40 text-accent text-sm font-semibold px-3.5 py-2 hover:bg-accent/5 disabled:opacity-50"
          >
            {busy === "revoke" ? "…" : "Revoke access (hard)"}
          </button>
        )}

        <button
          onClick={() => {
            if (
              confirm(
                `Give this machine its trial back? This deletes the trial claim so the hardware can earn a fresh window — the exact thing the ledger prevents. Use only for a genuine false positive.`,
              )
            ) {
              void run("trial-reset", () =>
                apiSend(`admin/users/${uid}/trial-reset`, "POST", { reason, confirmUserId: uid }),
              );
            }
          }}
          disabled={!!busy}
          className="rounded-xl border border-amber-500/40 text-amber-700 text-sm font-semibold px-3.5 py-2 hover:bg-amber-50 disabled:opacity-50"
        >
          {busy === "trial-reset" ? "…" : "Reset trial"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      {ok && <p className="mt-3 text-sm text-emerald-700">{ok}</p>}

      <p className="mt-4 text-xs text-muted leading-relaxed">
        Comp grants access with no payment (lifetime, or until a date — also how you extend a
        trial). Revoke outranks everything, including a paid licence (use for chargebacks / ToS).
        &ldquo;Auto-renew off&rdquo; cancels at Lemon Squeezy (the customer keeps access until the
        paid-through date, then it lapses); &ldquo;Auto-renew on&rdquo; resumes it before that date.
        Every action here is written to the admin audit log with the reason above.
      </p>

      {/* ── Test lab ── only when the backend allows test mode. Conjures a
          synthetic subscription (never a real payment): it is always test-mode,
          so the day the store goes live it stops granting on its own. */}
      {testTools && (
        <div className="mt-5 rounded-xl border border-dashed border-black/20 bg-bg p-4">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-ink">Test lab</h3>
            <Badge tone="ink">test mode</Badge>
          </div>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            Put this account mid-plan without paying, and set its remaining days — to exercise the
            resolver and the desktop gate. Synthetic rows are always test-mode and vanish from
            entitlement the moment the store goes live. The status badge above updates on the
            client&rsquo;s next entitlement fetch.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-muted gap-1">
              Status
              <select
                value={labStatus}
                onChange={(e) => setLabStatus(e.target.value)}
                className="text-sm rounded-lg border border-black/10 bg-card px-2 py-1.5 outline-none font-normal normal-case"
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-muted gap-1">
              Plan
              <select
                value={labInterval}
                onChange={(e) => setLabInterval(e.target.value)}
                className="text-sm rounded-lg border border-black/10 bg-card px-2 py-1.5 outline-none font-normal normal-case"
              >
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
              </select>
            </label>
            <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-muted gap-1">
              Days left
              <input
                type="number"
                min={0}
                max={730}
                value={labDays}
                onChange={(e) => setLabDays(e.target.value)}
                className="w-20 text-sm rounded-lg border border-black/10 bg-card px-2 py-1.5 outline-none font-normal"
              />
            </label>
            <button
              onClick={() =>
                run("conjure", () =>
                  apiSend(`admin/users/${uid}/test-subscription`, "POST", {
                    reason,
                    status: labStatus,
                    interval: labInterval,
                    remainingDays: Number(labDays) || 0,
                  }),
                )
              }
              disabled={!!busy}
              className="rounded-xl bg-ink text-white text-sm font-semibold px-3.5 py-2 disabled:opacity-50"
            >
              {busy === "conjure" ? "…" : "Conjure subscription"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The seven Lemon Squeezy statuses, for the test-lab selects. */
const STATUSES = ["on_trial", "active", "paused", "past_due", "unpaid", "cancelled", "expired"];

/**
 * How long this subscription has left, in days AND hours, with the shortcuts
 * that matter: "2d" is the trial-reminder window, "1h" is about-to-lapse, "0"
 * is gone. Pre-filled from the row so it reads as an edit, not a blank form.
 */
function TimeLeft({
  s,
  onApply,
  busy,
}: {
  s: AdminSubscription;
  onApply: (days: number, hours: number) => void;
  busy: boolean;
}) {
  const msLeft = s.validUntil ? Math.max(0, new Date(s.validUntil).getTime() - Date.now()) : 0;
  const [days, setDays] = useState(String(Math.floor(msLeft / 86_400_000)));
  const [hours, setHours] = useState(String(Math.floor((msLeft % 86_400_000) / 3_600_000)));

  const preset = (d: number, h: number) => {
    setDays(String(d));
    setHours(String(h));
    onApply(d, h);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted mr-0.5">Time left</span>
      <span className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-card pl-2 pr-1 py-0.5">
        <input
          type="number"
          min={0}
          max={730}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-12 text-xs bg-transparent outline-none"
          aria-label="days left"
        />
        <span className="text-[10px] text-muted">d</span>
        <input
          type="number"
          min={0}
          max={23}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="w-10 text-xs bg-transparent outline-none"
          aria-label="hours left"
        />
        <span className="text-[10px] text-muted">h</span>
        <button
          onClick={() => onApply(Number(days) || 0, Number(hours) || 0)}
          disabled={busy}
          className="rounded bg-ink text-white text-[11px] font-semibold px-2 py-0.5 disabled:opacity-40"
        >
          Apply
        </button>
      </span>
      {/* The three moments worth one click. 2 days is when the trial reminder
          (email + desktop toast) is due. */}
      <button onClick={() => preset(2, 0)} disabled={busy} className="rounded-lg border border-black/10 text-ink text-[11px] px-2 py-1 hover:bg-black/5 disabled:opacity-40">2d — reminder</button>
      <button onClick={() => preset(0, 1)} disabled={busy} className="rounded-lg border border-black/10 text-ink text-[11px] px-2 py-1 hover:bg-black/5 disabled:opacity-40">1h</button>
      <button onClick={() => preset(0, 0)} disabled={busy} className="rounded-lg border border-black/10 text-ink text-[11px] px-2 py-1 hover:bg-black/5 disabled:opacity-40">0 — now</button>
    </div>
  );
}
