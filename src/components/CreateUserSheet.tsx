"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";

/**
 * Provision an account without the person being there.
 *
 * Neither ordinary door can be used on someone else's behalf: registration
 * mails a six-digit code to an inbox we cannot read, and the funnel is fifteen
 * screens that would have to be answered AS them. This form performs the same
 * writes in one go — verified address, funnel answers, grant — through
 * `POST /admin/users`.
 *
 * Built for a PHONE first, because that is where it gets used: someone is stood
 * in front of you and wants an account. Hence the full-height sheet on small
 * screens, the 16px inputs (anything smaller and iOS Safari zooms the page on
 * focus, and the form jumps under the thumb), the numeric keypads, and a submit
 * button that never scrolls away.
 */

/** 16px, not 14: below that iOS Safari zooms on focus. Worth the extra weight
 *  here even though the rest of the console uses text-sm. */
const field =
  "w-full rounded-xl border border-black/10 bg-card px-3.5 py-2.5 text-base outline-none focus:border-ink/40";
const label = "block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5";

/** Only the two the console offers. `pro` is time-boxed by the backend; only
 *  `lifetime` may be permanent, and then only when it is confirmed. */
const PLANS = [
  { value: "lifetime", label: "Lifetime" },
  { value: "pro", label: "Pro" },
] as const;

const AGE_MIN = 16;
const MAX_DAILY_HOURS = 12;

type Created = { user: { id: string; email: string }; entitlement?: { status?: string } };

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function CreateUserSheet({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [university, setUniversity] = useState("");
  const [hours, setHours] = useState("");
  const [plan, setPlan] = useState<string>("lifetime");
  const [until, setUntil] = useState(todayPlus(365));
  const [confirmPermanent, setConfirmPermanent] = useState(false);
  const [reason, setReason] = useState("created from the console");

  const permanent = plan === "lifetime" && !until;

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setAge("");
    setUniversity("");
    setHours("");
    setPlan("lifetime");
    setUntil(todayPlus(365));
    setConfirmPermanent(false);
    setReason("created from the console");
    setError("");
    setCreated(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  // Escape closes, and the page behind must not scroll under the sheet — on a
  // phone that is the difference between a dialog and a confusing overlay.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // Numbers go over the wire as numbers: the schema is strict about it, and
      // "19" would be refused rather than coerced.
      const res = await apiSend<Created>("admin/users", "POST", {
        email: email.trim(),
        password,
        ...(name.trim() ? { name: name.trim() } : {}),
        age: Number(age),
        ...(university.trim() ? { university: university.trim() } : {}),
        hours: Number(hours),
        plan,
        // An empty date field means "no end". Sent as null rather than omitted,
        // so it reads as a decision and not as a field that was forgotten.
        until: until ? new Date(`${until}T23:59:59`).toISOString() : null,
        ...(permanent ? { confirmPermanent } : {}),
        reason: reason.trim(),
      });
      setCreated(res);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-ink text-white text-sm font-semibold px-4 py-2.5 hover:opacity-90 transition"
      >
        New account
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-ink text-white text-sm font-semibold px-4 py-2.5 hover:opacity-90 transition"
      >
        New account
      </button>

      <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center">
        <div className="absolute inset-0 bg-ink/40" onClick={close} aria-hidden="true" />

        {/* Full height on a phone, a centred card from `sm` up. The inner
            column is the scroller so the footer button stays put. */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create an account"
          // dvh, not vh/full: with the on-screen keyboard up, the layout
          // viewport does not shrink, and a sheet sized to it puts its own
          // footer button behind the keyboard.
          className="relative w-full sm:max-w-2xl bg-paper sm:rounded-2xl shadow-xl flex flex-col max-h-[100dvh] sm:max-h-[90dvh]"
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 flex-none">
            <h2 className="font-bold text-ink">{created ? "Account created" : "New account"}</h2>
            <button
              onClick={close}
              aria-label="Close"
              className="text-muted hover:text-ink transition p-1 -mr-1"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {created ? (
            <div className="p-5 overflow-y-auto">
              <p className="text-sm text-ink">
                <span className="font-semibold">{created.user.email}</span> can sign in now — the
                address is already verified and the funnel is skipped.
              </p>
              {created.entitlement?.status && (
                <p className="text-sm text-muted mt-2">
                  The resolver says: <span className="text-ink font-medium">{created.entitlement.status}</span>
                </p>
              )}
              <p className="text-sm text-muted mt-4">
                Send them the password you just set — it is not stored anywhere it can be read back.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-5">
                <button
                  onClick={() => router.push(`/users/${created.user.id}`)}
                  className="rounded-xl bg-ink text-white text-sm font-semibold px-4 py-2.5 hover:opacity-90 transition"
                >
                  Open the profile
                </button>
                <button
                  onClick={reset}
                  className="rounded-xl border border-black/10 text-sm font-semibold px-4 py-2.5 text-ink hover:bg-black/[0.03] transition"
                >
                  Create another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col min-h-0 flex-1">
              <div className="p-5 overflow-y-auto space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={label} htmlFor="cu-name">Name</label>
                    <input
                      id="cu-name"
                      ref={firstFieldRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Selim"
                      autoComplete="off"
                      className={field}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="cu-email">Email</label>
                    <input
                      id="cu-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="selim@example.com"
                      // The phone keyboard would otherwise capitalise the first
                      // letter and autocorrect the domain.
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="email"
                      autoComplete="off"
                      className={field}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="cu-age">Age</label>
                    <input
                      id="cu-age"
                      required
                      value={age}
                      onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="19"
                      inputMode="numeric"
                      className={field}
                    />
                    <p className="text-[11px] text-muted mt-1">
                      {AGE_MIN}+. Only the band is stored, never the number.
                    </p>
                  </div>
                  <div>
                    <label className={label} htmlFor="cu-hours">Screen time (h/day)</label>
                    <input
                      id="cu-hours"
                      required
                      value={hours}
                      onChange={(e) => setHours(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="8"
                      inputMode="numeric"
                      className={field}
                    />
                    <p className="text-[11px] text-muted mt-1">0–{MAX_DAILY_HOURS}, as they report it.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={label} htmlFor="cu-university">University</label>
                    <input
                      id="cu-university"
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      placeholder="HEC Montréal"
                      autoComplete="off"
                      className={field}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={label} htmlFor="cu-password">Password</label>
                    <input
                      id="cu-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="at least 8 characters"
                      autoComplete="new-password"
                      className={field}
                    />
                    <p className="text-[11px] text-muted mt-1">
                      Give it to them yourself — it is hashed on arrival and can never be read back.
                    </p>
                  </div>
                </div>

                <div className="border-t border-black/5 pt-4 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={label} htmlFor="cu-plan">Plan</label>
                      <select
                        id="cu-plan"
                        value={plan}
                        onChange={(e) => {
                          setPlan(e.target.value);
                          // Leaving a stale "no end date" behind while switching
                          // to a plan that requires one is a 400 the operator
                          // cannot see the cause of.
                          if (e.target.value !== "lifetime" && !until) setUntil(todayPlus(365));
                          setConfirmPermanent(false);
                        }}
                        className={field}
                      >
                        {PLANS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={label} htmlFor="cu-until">
                        Ends on {plan === "lifetime" && <span className="normal-case font-medium">(blank = never)</span>}
                      </label>
                      <input
                        id="cu-until"
                        type="date"
                        value={until}
                        required={plan !== "lifetime"}
                        onChange={(e) => setUntil(e.target.value)}
                        className={field}
                      />
                    </div>
                  </div>

                  {/* The ceremony for a grant with no end. POST /users/:id/plan
                      asks for the target's id to be typed back; that id does not
                      exist yet, so this stands in for it. */}
                  {permanent && (
                    <label className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmPermanent}
                        onChange={(e) => setConfirmPermanent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 flex-none accent-ink"
                      />
                      <span className="text-sm text-amber-900">
                        This grant <span className="font-semibold">never expires</span>. It will not show
                        up in any renewal report — the only way it ends is if someone remembers it exists.
                      </span>
                    </label>
                  )}

                  <div>
                    <label className={label} htmlFor="cu-reason">Reason (audited)</label>
                    <input
                      id="cu-reason"
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className={field}
                    />
                  </div>
                </div>

              </div>

              {/* Outside the scroller: on a phone this is the only thing the
                  thumb needs to reach, and it must never be below the fold.
                  The error lives here too — inside the scroller it would appear
                  wherever the operator is NOT looking, which for a form this
                  long means a submit that seems to have done nothing. */}
              <div className="px-5 py-4 border-t border-black/5 bg-card/60 flex-none">
                {error && (
                  <p role="alert" className="text-sm text-accent mb-3">
                    {error}
                  </p>
                )}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl border border-black/10 text-sm font-semibold px-4 py-2.5 text-ink hover:bg-black/[0.03] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || (permanent && !confirmPermanent)}
                  className="rounded-xl bg-ink text-white text-sm font-semibold px-4 py-2.5 hover:opacity-90 transition disabled:opacity-40"
                >
                  {busy ? "Creating…" : "Create account"}
                </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
