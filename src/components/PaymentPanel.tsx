"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import { Badge } from "@/components/ui";
import ResetTestUser from "@/components/ResetTestUser";
import { fmtDate } from "@/lib/format";
import type { AdminUser, AdminPurchase, AdminSubscription } from "@/lib/types";

/**
 * Everything an operator can do to an account's PAYMENT state, in one place:
 * see what they actually paid for, grant access without a payment (comp), take
 * it away (revoke), give a machine its trial back, and cancel a live
 * subscription. Every write goes to an audited backend route with a reason.
 */
/**
 * What the backend actually answered, as fields.
 *
 * Every one of these is decided server-side and sent explicitly. The console
 * used to work out what had happened by matching words in an English error
 * string — which meant a reworded message silently changed what an operator was
 * told, and "queued" and "rejected" were indistinguishable because both arrived
 * as red prose.
 */
type CancelResult = {
  cancelled?: boolean;
  queued?: boolean;
  entitlementRevoked?: boolean;
};

/**
 * The one sentence an operator sees, built from those fields.
 *
 * `entitlementRevoked` is separate from `cancelled` on purpose: a cancellation
 * can be accepted while access continues to the end of the current period, and it
 * can be recorded-but-not-yet-sent while access has already stopped. Collapsing
 * them into one "done" is what made the console unable to say either.
 */
function describeCancel(out: CancelResult): string {
  const access = out.entitlementRevoked
    ? "Access has ended immediately."
    : "The customer keeps access until the current access period ends.";
  if (out.queued) {
    return `Cancellation recorded — waiting on the payment provider. ${access}`;
  }
  if (out.cancelled) {
    return `Auto-renewal is off. ${access}`;
  }
  // Neither confirmed nor owed. Saying anything reassuring here would be a lie.
  return "The provider did not accept the cancellation. Nothing has changed.";
}

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
      // A STRING BACK MEANS "say this". Actions that have nothing specific to
      // report still resolve to undefined and keep the old flat acknowledgement;
      // the cancellation has a real outcome to describe and returns it.
      const said = await fn();
      setOk(typeof said === "string" ? said : "Done.");
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

  /**
   * Is this row a trial right now?
   *
   * The SAME question the backend answers with `isCurrentTrial`, and the reason
   * the console may state a different outcome: a trial keeps no remaining period,
   * so cancelling it stops access at once. Status plus a future end date, never
   * the date alone — a subscription that converted early can still carry a
   * `trialEndsAt` in the future, and treating that as a trial would promise a
   * paying customer an immediate cut-off that will not happen.
   */
  const isTrial = (s: AdminSubscription) =>
    s.status === "on_trial" &&
    !!s.trialEndsAt &&
    new Date(s.trialEndsAt).getTime() > Date.now();

  // A synthetic test-lab row (never touches Lemon Squeezy) vs a real one.
  const isSim = (s: AdminSubscription) => s.testMode === true && s.externalId.startsWith("sim_");

  /** Move a subscription to a lifecycle state — real LS op when the row is real. */
  const transition = async (s: AdminSubscription, to: string) => {
    const out = (await apiSend(`admin/users/${uid}/subscription-transition`, "POST", {
      reason,
      externalId: s.externalId,
      to,
    })) as { to?: string; via?: string };
    // 202 `{ok, to, via}`. `via` is the product's own word for who actually did
    // it — an operator needs to know whether the provider was touched.
    const where = out?.via === "lemonsqueezy" ? "at Lemon Squeezy" : "locally";
    return `Now ${out?.to ?? to} — applied ${where}.`;
  };

  /** Set how long it has left, in days AND hours. */
  const setTime = async (s: AdminSubscription, days: number, hours: number) => {
    const out = (await apiSend(`admin/users/${uid}/subscription-time`, "POST", {
      reason,
      externalId: s.externalId,
      days,
      hours,
    })) as { validUntil?: string; via?: string };
    // 202 `{ok, validUntil, via}` — rendered through the same UTC formatter as
    // every other date on this page, so it cannot disagree with them.
    return out?.validUntil
      ? `Time left set — now valid until ${fmtDate(out.validUntil)}.`
      : "Time left set.";
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
                    {isSim(s) ? (
                      <Badge tone="ink">sim</Badge>
                    ) : (
                      s.testMode && <Badge tone="amber">test</Badge>
                    )}

                    {/* Real subscriptions: auto-renewal off (cancel) / on (resume). */}
                    {!isSim(s) && grantsNow(s) && s.status !== "cancelled" && (
                      <button
                        onClick={() => {
                          // Turning off a paying customer's renewal is
                          // destructive and was one click away, while "Grant
                          // lifetime" and "Revoke access" each ask first. An
                          // audited reason records WHO did it; it does not stop
                          // a mis-click from doing it.
                          //
                          // The message names the plan, because a profile can
                          // carry several rows and "are you sure?" tells the
                          // operator nothing about which one they are about to
                          // stop. No email, no id — nothing sensitive in a
                          // dialogue that may be screenshotted into a ticket.
                          // TWO MESSAGES, because the two outcomes are not the
                          // same promise. Cancelling a paid subscription takes
                          // nothing away today; cancelling a TRIAL ends access on
                          // the spot and burns the trial for good. An operator
                          // told the first while doing the second has misinformed
                          // the customer they are on the phone to.
                          //
                          // The wording avoids "paid period" on purpose: `active`
                          // is also what a 100% discount produces, and there is no
                          // payment ledger here to check. See
                          // ACCESS_CONTINUES_MESSAGE in the backend.
                          const plan = s.interval ?? "current";
                          const message = isTrial(s)
                            ? `Cancel the ${plan} trial? Access will end immediately and this account will not receive another trial.`
                            : `Turn off auto-renewal for the ${plan} subscription? The customer keeps access until the current access period ends and will not be charged again.`;
                          if (!confirm(message)) return;
                          run("cancel:" + s.id, async () => {
                            const out = (await apiSend(
                              `admin/users/${uid}/cancel-subscription`,
                              "POST",
                              { reason, externalId: s.externalId },
                            )) as CancelResult;
                            return describeCancel(out);
                          });
                        }}
                        disabled={!!busy}
                        // "Auto-renew off" alone says neither WHICH subscription
                        // nor what it does to the customer — and a profile can
                        // carry several rows, so a screen reader announced the
                        // same three words two or three times over. The visible
                        // label is unchanged; only the announced one is fuller.
                        aria-label={`Turn off auto-renewal for the ${s.interval ?? "current"} subscription`}
                        className="ml-auto rounded-lg border border-accent/40 text-accent text-xs font-semibold px-2.5 py-1 hover:bg-accent/5 disabled:opacity-40"
                      >
                        {busy === "cancel:" + s.id ? "…" : "Auto-renew off"}
                      </button>
                    )}
                    {!isSim(s) && grantsNow(s) && s.status === "cancelled" && (
                      <button
                        onClick={() =>
                          run("resume:" + s.id, async () => {
                            const out = (await apiSend(
                              `admin/users/${uid}/reactivate-subscription`,
                              "POST",
                              { reason, externalId: s.externalId },
                            )) as { renewsAt?: string | null };
                            // 202 `{ok, renewsAt}`. Reporting the date the
                            // provider gave back, rather than a flat "Done.",
                            // is what tells an operator the resume actually
                            // took at Lemon Squeezy.
                            return out?.renewsAt
                              ? `Auto-renewal is back on — renews ${fmtDate(out.renewsAt)}.`
                              : "Auto-renewal is back on.";
                          })
                        }
                        disabled={!!busy}
                        // NAMED, like its sibling. "Auto-renew on" alone says
                        // neither which subscription nor what it does, and a
                        // profile can carry several rows — a screen reader
                        // announced the same three words two or three times
                        // over. The cancel button beside it was fixed for
                        // exactly this reason; this one was left behind, which
                        // also made it unaddressable by an unambiguous locator.
                        aria-label={`Turn auto-renewal back on for the ${s.interval ?? "current"} subscription`}
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
                          onClick={() => {
                            // NOT A TEST BUTTON, whatever the panel it sits in.
                            // For a real row this issues DELETE /v1/subscriptions
                            // at Lemon Squeezy — an actual customer's plan, gone.
                            // It sat one unconfirmed click away, inches from a
                            // control that does ask, with nothing to tell them
                            // apart. A synthetic row is local and harmless, and
                            // the wording says which of the two this is.
                            const real = !isSim(s);
                            const where = real
                              ? "This cancels the subscription at Lemon Squeezy for real."
                              : "This is a simulated row — the change is local only.";
                            if (
                              !confirm(
                                `Cancel the ${s.interval ?? "current"} subscription? ${where}`,
                              )
                            )
                              return;
                            void run("to-cancelled:" + s.id, () => transition(s, "cancelled"));
                          }}
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
        {/*
          htmlFor/id: the label was rendered next to the field but never bound to
          it, so a screen reader announced an unlabelled text box on the one input
          every audited write depends on. Binding them is the accessibility fix
          and, incidentally, what lets a test address the field by its name
          rather than by matching a long placeholder string.
        */}
        <label
          htmlFor="admin-reason"
          className="block text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5"
        >
          Reason (audited)
        </label>
        <input
          id="admin-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. support goodwill after a botched reinstall"
          className="w-full h-10 px-3 rounded-lg border border-black/10 bg-card text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      {/* Grant without a payment. */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          onClick={() => {
            // A never-expiring grant, previously one click. The identical
            // outcome through "Set plan" -> lifetime is guarded by a confirm AND
            // by confirmUserId server-side; this door had neither, so the
            // stronger guard was simply the one nobody used.
            if (
              !confirm(
                "Grant a LIFETIME comp with NO end date? Nothing will ever expire it — it ends only when someone revokes it by hand. Use the dated grant beside this button if it is temporary.",
              )
            )
              return
            run("comp-life", () => apiSend(`admin/users/${uid}/comp`, "POST", { reason }))
          }}
          disabled={!!busy}
          className="rounded-xl bg-ink text-white text-sm font-semibold px-3.5 py-2 disabled:opacity-50"
        >
          {busy === "comp-life" ? "…" : "Grant lifetime (comp)"}
        </button>

        <div className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-card pl-2 pr-1.5 py-1">
          <input
            type="date"
            // The only way to address this field, and the only way a screen
            // reader announces what the date is FOR.
            aria-label="Complimentary access until"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="text-sm bg-transparent outline-none"
          />
          <button
            onClick={() =>
              run("comp-until", () =>
                apiSend(`admin/users/${uid}/comp`, "POST", {
                  reason,
                  // `${until}T00:00:00.000Z`, not `new Date(until)`. A date-only value
          // parsed as local midnight lands on the PREVIOUS day in any timezone
          // east of UTC — an operator in Tokyo choosing the 4th would have
          // granted access to the 3rd.
          until: until ? `${until}T00:00:00.000Z` : undefined,
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
            onClick={() => {
                // This ends a grant the customer is using right now. Granting
                // asks; taking away did not.
                if (!confirm("Withdraw the complimentary access? It ends immediately."))
                  return;
                void run("comp-off", () =>
                  apiSend(`admin/users/${uid}/comp`, "DELETE", { reason }),
                );
              }
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
            onClick={() => {
              // The most destructive billing action in this console: it outranks
              // a live purchase and cuts a paying customer off immediately. Less
              // severe actions here (Reset trial, Delete) already confirm; this
              // one did not.
              if (
                !confirm(
                  "Revoke access for this account? This outranks everything — including a live paid subscription — and takes effect at once. Reason recorded: " +
                    (reason || "(none)"),
                )
              )
                return
              run("revoke", () => apiSend(`admin/users/${uid}/revoke`, "POST", { reason }))
            }}
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
              void run("trial-reset", async () => {
                const out = (await apiSend(`admin/users/${uid}/trial-reset`, "POST", {
                  reason,
                  confirmUserId: uid,
                })) as { claimsDeleted?: number };
                // `{user, claimsDeleted}`. Zero is the interesting answer — it
                // means the ledger had nothing on this machine and the operator
                // has just not fixed what they thought they were fixing.
                const n = out?.claimsDeleted ?? 0;
                return `Reset — ${n} trial claim${n === 1 ? "" : "s"} deleted.`;
              });
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

      {/* ── Reset test user ── also test-gated. Email-keyed (not tied to the
          account on this page), so the tester frees any address in one call —
          and gets the leg-by-leg report, with the Apple caveat, right here. */}
      {testTools && <ResetTestUser />}
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
/**
 * NAMED PER ROW. Two of these can be on screen at once — one per subscription,
 * and the test lab's conjure form carries its own — so "days left" alone matched
 * more than one field. The same ambiguity the resume button had.
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
  // Which row these fields belong to, so two of them on one page are never the
  // same name. `interval` is what the cancel and resume buttons use too.
  const label = `${s.interval ?? "current"} subscription`;
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
          aria-label={`days left for the ${label}`}
        />
        <span className="text-[10px] text-muted">d</span>
        <input
          type="number"
          min={0}
          max={23}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="w-10 text-xs bg-transparent outline-none"
          aria-label={`hours left for the ${label}`}
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
