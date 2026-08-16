"use client";

import { useState } from "react";
import { apiSend } from "@/lib/client";
import { Badge } from "@/components/ui";
import type { TestResetReport } from "@/lib/types";

/**
 * The test lab's "Reset test user" — make an email reusable for a fresh signup
 * in one call instead of hand-deleting half a database and minting orphans.
 *
 * The email is typed TWICE because this deletes an entire account and its
 * billing state: like `confirmUserId` on the trial reset, the confirmation is
 * the safety mechanism, and the backend enforces the exact match again.
 *
 * The report is rendered LEG BY LEG, exactly as the backend answered — the
 * tool's whole value is trust, so a partial reset shows precisely which legs
 * ran and which failed (errors verbatim), and the Apple sentence is always on
 * screen: RevenueCat and our rows are cleaned here; Apple's sandbox purchase
 * history is not ours to clean and the tool never claims it is.
 */
export default function ResetTestUser() {
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; report: TestResetReport } | null>(null);

  const match = email.trim().length > 0 && email.trim() === confirmEmail.trim();

  async function reset() {
    if (
      !confirm(
        `Reset ${email.trim()}? This deletes the account, ends its sessions, deletes its RevenueCat subscriber(s), cancels its Lemon Squeezy billing and clears its trial claims. Apple-side sandbox purchase history is NOT touched.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const out = await apiSend<{ ok: boolean; report: TestResetReport }>(
        "admin/test/reset-user",
        "POST",
        { email: email.trim(), confirmEmail: confirmEmail.trim() },
      );
      setResult(out);
      setEmail("");
      setConfirmEmail("");
    } catch (e) {
      // The backend's own sentence, verbatim — "No account with that email" is
      // an answer, not a failure to hide behind a generic message.
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    // Deliberately NO router.refresh(): the reset may have deleted the very
    // account this page shows, and the report must stay readable either way.
  }

  const report = result?.report;

  return (
    <div className="mt-5 rounded-xl border border-dashed border-black/20 bg-bg p-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-bold text-ink">Reset test user</h3>
        <Badge tone="ink">test mode</Badge>
      </div>
      <p className="text-xs text-muted mb-3 leading-relaxed">
        Frees an email for a fresh signup: deletes the account, revokes its sessions, deletes its
        RevenueCat subscriber(s), cancels Lemon Squeezy billing through the outbox, and clears its
        trial claims and RevenueCat order tombstones. Each step reports separately below — and
        Apple sandbox purchase history is never touched (it can&rsquo;t be, from here).
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-muted gap-1">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tester@example.com"
            className="w-56 text-sm rounded-lg border border-black/10 bg-card px-2 py-1.5 outline-none font-normal normal-case"
          />
        </label>
        <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-muted gap-1">
          Confirm email
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="type it again"
            className="w-56 text-sm rounded-lg border border-black/10 bg-card px-2 py-1.5 outline-none font-normal normal-case"
          />
        </label>
        <button
          onClick={() => void reset()}
          disabled={busy || !match}
          title={match ? "Reset this test user" : "Both emails must match exactly"}
          className="rounded-xl border border-accent/40 text-accent text-sm font-semibold px-3.5 py-2 hover:bg-accent/5 disabled:opacity-40"
        >
          {busy ? "…" : "Reset test user"}
        </button>
      </div>
      {confirmEmail.trim().length > 0 && !match && (
        <p className="mt-2 text-xs text-amber-700">The two emails must match exactly.</p>
      )}

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {result && report && (
        <div className="mt-4 rounded-lg border border-black/10 bg-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-ink">Reset report</span>
            {result.ok ? (
              <Badge tone="green">all steps completed</Badge>
            ) : (
              <Badge tone="red">partial — see failed steps</Badge>
            )}
          </div>

          <ul className="space-y-1.5 text-sm">
            <Leg
              ok={report.sessionsRevoked}
              label="Sessions"
              detail={
                report.sessionsRevoked
                  ? "every outstanding token is now invalid"
                  : "NOT revoked"
              }
            />
            <Leg
              ok={report.rcSubscriberFailures.length === 0}
              label="RevenueCat"
              detail={
                report.rcSubscribersDeleted.length === 0 &&
                report.rcSubscriberFailures.length === 0
                  ? "no subscribers to delete"
                  : `${report.rcSubscribersDeleted.length} subscriber${
                      report.rcSubscribersDeleted.length === 1 ? "" : "s"
                    } deleted${
                      report.rcSubscriberFailures.length > 0
                        ? `, ${report.rcSubscriberFailures.length} failed`
                        : ""
                    }`
              }
            />
            {report.rcSubscriberFailures.map((f) => (
              <li key={f.appUserId} className="ml-6 text-xs text-accent">
                {f.appUserId}: {f.error}
              </li>
            ))}
            <Leg
              ok
              label="Lemon Squeezy"
              detail={`${report.lsCancelsEnqueued} cancellation${
                report.lsCancelsEnqueued === 1 ? "" : "s"
              } enqueued`}
            />
            <Leg
              ok={report.accountDeleted}
              label="Account"
              detail={report.accountDeleted ? "deleted (with its cascaded records)" : "NOT deleted"}
            />
            <Leg
              ok
              label="Trial ledger"
              detail={`${report.trialClaimsDeleted} claim${
                report.trialClaimsDeleted === 1 ? "" : "s"
              } deleted (device signals with them)`}
            />
            <Leg
              ok
              label="Order tombstones"
              detail={`${report.consumedOrdersDeleted} RevenueCat tombstone${
                report.consumedOrdersDeleted === 1 ? "" : "s"
              } deleted — Lemon Squeezy tombstones stay spent`}
            />
          </ul>

          {report.failures.length > 0 && (
            <div className="mt-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-1">
                Failed steps
              </div>
              <ul className="space-y-1">
                {report.failures.map((f) => (
                  <li key={f.step} className="text-xs text-accent">
                    <span className="font-semibold">{f.step}</span>: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* The sentence the backend sends on EVERY reset — amber because it
              is the one thing the operator still has to do by hand. */}
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-50 p-2.5 text-xs text-amber-800 leading-relaxed">
            <span className="font-bold">Apple side:</span> {report.appleSide}
          </div>
        </div>
      )}
    </div>
  );
}

/** One leg of the report: a pass/fail dot, the leg's name, what happened. */
function Leg({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-baseline gap-2">
      <span
        aria-hidden
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
      />
      <span className="font-semibold text-ink">{label}</span>
      <span className={ok ? "text-muted" : "text-accent font-medium"}>{detail}</span>
    </li>
  );
}
