"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";

/**
 * The plan names the backend actually accepts — mirrored by hand from
 * `cloud-backend/src/validation/schemas.ts` (GRANTING_PLAN_NAMES) and
 * `src/routes/admin.ts` (WITHDRAWING_PLANS). Anything else is refused with a
 * 400 rather than silently treated as "withdraw".
 *
 * The old dropdown offered "trial" and "free" as if they were siblings of
 * "pro": "trial" was an unknown name (the backend spells it "trialing") and
 * every granting option 400'd for want of a reason and an end date. Granting
 * and withdrawing are different actions, so the select says which is which.
 */
const GRANTING_PLANS = ["pro", "lifetime", "active", "comped", "trialing"];
const WITHDRAWING_PLANS = ["free", "none", "expired", "revoked"];

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
  const [planValue, setPlanValue] = useState("");
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [error, setError] = useState("");

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      // The message is the backend's own words (its 400s name the missing
      // field and the valid plan names) — never a generic "Failed".
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const suspended = status === "suspended";

  const granting = GRANTING_PLANS.includes(planValue);
  const lifetime = planValue === "lifetime";
  // Every granting plan except lifetime must carry an end date; a lifetime
  // grant may, and without one it is PERMANENT — which the backend only
  // accepts with the user id typed back (confirmUserId), same shape as the
  // trial reset's confirmation.
  const needsUntil = granting && !lifetime;
  const permanent = lifetime && !until;
  const reasonOk = reason.trim().length >= 3;
  const canSubmit =
    !!planValue &&
    reasonOk &&
    (!needsUntil || !!until) &&
    (!permanent || confirmId.trim() === userId);

  function submitPlan() {
    run("plan", async () => {
      await apiSend(`admin/users/${userId}/plan`, "POST", {
        plan: planValue,
        reason: reason.trim(),
        // `null`, not an omitted field: the schema distinguishes "no end date,
        // on purpose" from "field forgotten", and only the first is accepted.
        until: until ? new Date(until).toISOString() : null,
        ...(permanent ? { confirmUserId: confirmId.trim() } : {}),
      });
      setPlanValue("");
      setReason("");
      setUntil("");
      setConfirmId("");
    });
  }

  return (
    <div className="flex flex-col items-start md:items-end gap-2">
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
      </div>

      {/* Set plan — a complimentary grant (or its withdrawal), audited with a
          reason like every other entitlement write. */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-black/10 bg-card p-1.5">
        <select
          value={planValue}
          onChange={(e) => setPlanValue(e.target.value)}
          aria-label="Plan to set"
          className="text-sm bg-transparent outline-none px-1"
        >
          <option value="" disabled>
            Set plan… (now: {plan})
          </option>
          <optgroup label="Grant (complimentary)">
            {GRANTING_PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </optgroup>
          <optgroup label="Withdraw grant">
            {WITHDRAWING_PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </optgroup>
        </select>

        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="reason (audited, 3+ chars)"
          aria-label="Reason for the plan change (audited)"
          className="w-48 text-sm rounded-lg border border-black/10 bg-bg px-2 py-1.5 outline-none focus:border-ink/40"
        />

        {granting && (
          <input
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            aria-label={
              lifetime
                ? "Grant ends at (leave empty for a permanent lifetime grant)"
                : "Grant ends at (required)"
            }
            title={
              lifetime
                ? "Optional for lifetime — leave empty for a permanent grant"
                : "Required — every grant except lifetime must have an end date"
            }
            className="text-sm rounded-lg border border-black/10 bg-bg px-2 py-1 outline-none focus:border-ink/40"
          />
        )}

        {permanent && (
          <input
            value={confirmId}
            onChange={(e) => setConfirmId(e.target.value)}
            placeholder={`type ${userId} to confirm`}
            aria-label="Confirm the user id for a permanent lifetime grant"
            title="A lifetime grant with no end date never expires — repeat the user id to confirm"
            className="w-56 text-xs font-mono rounded-lg border border-accent/40 bg-bg px-2 py-1.5 outline-none focus:border-accent"
          />
        )}

        <button
          onClick={submitPlan}
          disabled={!!busy || !canSubmit}
          className="rounded-lg bg-ink text-white text-xs font-semibold px-2.5 py-1.5 disabled:opacity-40"
        >
          {busy === "plan" ? "…" : "Set plan"}
        </button>
      </div>

      {error && <span className="text-sm text-accent max-w-md text-left md:text-right">{error}</span>}
    </div>
  );
}
