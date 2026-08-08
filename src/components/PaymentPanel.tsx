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
}: {
  user: AdminUser;
  purchases: AdminPurchase[];
  subscriptions: AdminSubscription[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");

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
                    {s.testMode && <Badge tone="amber">test</Badge>}
                    {grantsNow(s) && s.status !== "cancelled" && (
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
                        {busy === "cancel:" + s.id ? "…" : "Cancel"}
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
        Cancelling a subscription is graceful: the customer keeps access until the paid-through date,
        then it lapses. Every action here is written to the admin audit log with the reason above.
      </p>
    </div>
  );
}
