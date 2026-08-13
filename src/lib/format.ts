// Small display helpers (no external deps).

export function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export function fmtHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/**
 * Dates in this console are rendered in UTC, from explicit getters.
 *
 * WHY NOT `toLocaleString(undefined, …)`, which is what these were. `undefined`
 * means "the runtime's locale", and the runtime is not the same on both sides:
 * Node rendered "10 Sept 2026, 10:54" while the browser rendered
 * "Sep 10, 2026, 10:54 AM". React saw the mismatch, discarded the subtree and
 * re-rendered it — silently wiping whatever an operator had typed into the
 * audited-reason field, with no error and no way to tell it had happened.
 *
 * The fix is determinism, not suppression: no `suppressHydrationWarning`, no
 * client-only rendering, no empty server render. Two identical strings.
 *
 * UTC rather than local time is also the right answer for an admin console —
 * every operator reads the same instant, and it matches the ISO timestamps the
 * backend logs and audits with.
 */
const pad = (n: number): string => String(n).padStart(2, "0");

/** `2026-09-10 10:54 UTC`, or the em dash for absent/invalid input. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

/** `2026-09-10`, same rules. */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
