// Shapes mirroring the backend admin API responses (cloud-backend/src/routes/admin.ts
// + services/admin-stats.ts). Kept in sync by hand.

export interface Overview {
  totalUsers: number;
  suspendedUsers: number;
  usersByPlan: Record<string, number>;
  newUsers7d: number;
  newUsers30d: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalSessions: number;
  sessionsToday: number;
  sessions7d: number;
  totalFocusSeconds: number;
  focusSeconds7d: number;
  liveSessionsCount: number;
  totalDevices: number;
}

/**
 * Arrivals from a tagged link — the QR code on the flyers, today.
 *
 * `total` is every day ever; `days` is the recent window the dashboard draws,
 * oldest first and zero-filled, because a day nobody scanned is a zero and not
 * a gap.
 */
export interface ReferralSourceSummary {
  source: string;
  total: number;
  today: number;
  last7d: number;
  days: { day: string; count: number }[];
}

export interface ReferralsSummary {
  sources: ReferralSourceSummary[];
  windowDays: number;
}

export interface LiveSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string | null;
  platform: string | null;
  name: string;
  phase: string;
  hardLock: boolean;
  totalSeconds: number;
  remainSeconds: number;
  killedTotal: number;
  appsCount: number;
  sitesCount: number;
  originEventId: string | null;
  startedAt: string;
  endsAt: string | null;
  forceEnd: boolean;
  lastHeartbeatAt: string;
  createdAt: string;
  user?: { email: string; plan: string; status: string | null };
}

export interface UserListItem {
  id: string;
  email: string;
  plan: string;
  status: string;
  createdAt: string;
  deviceCount: number;
  sessionCount: number;
  totalFocusSeconds: number;
  lastActiveAt: string | null;
  liveNow: boolean;
}

export interface UsersListResult {
  users: UserListItem[];
  total: number;
  skip: number;
  take: number;
}

export interface UserStats {
  totalSessions: number;
  completedSessions: number;
  abortedSessions: number;
  completionRate: number;
  hardLockSessions: number;
  emergencyUsedCount: number;
  totalFocusSeconds: number;
  avgSessionSeconds: number;
  totalKilled: number;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  sessionsLast7d: number;
  sessionsLast30d: number;
  focusSecondsLast7d: number;
  focusSecondsLast30d: number;
  firstSessionAt: string | null;
  lastSessionAt: string | null;
  sessionsByWeekday: number[];
  focusByDay: { day: string; seconds: number; sessions: number }[];
  topSessionNames: { name: string; count: number }[];
}

export interface Device {
  id: string;
  name: string;
  platform: string;
  kind: string | null;
  deviceId: string | null;
  model: string | null;
  osVersion: string | null;
  appVersion: string | null;
  lastSeenAt: string;
  createdAt: string;
}

export interface FocusEvent {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string;
  plannedSeconds: number;
  completed: boolean;
  hardLock: boolean;
  killedTotal: number;
  platform: string | null;
  emergencyUsed: boolean | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  emailVerified: boolean | null;
  plan: string;
  status: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Entitlement overrides + cache (from toPublicUser). These drive the payment
  // panel: whether a comp/revoke is currently in force, and what the resolver
  // last computed.
  entitlementStatus?: string | null;
  isProCached?: boolean | null;
  compActive?: boolean | null;
  compReason?: string | null;
  compedUntil?: string | null;
  accessRevoked?: boolean | null;
  revokedReason?: string | null;
}

export interface AdminPurchase {
  id: string;
  provider: string;
  externalId: string;
  productId: string;
  priceUsd: number | null;
  purchasedAt: string;
  isRefunded: boolean;
  refundedAt: string | null;
  testMode: boolean | null;
}

export interface AdminSubscription {
  id: string;
  provider: string;
  externalId: string;
  variantId: string;
  interval: string | null;
  status: string;
  validUntil: string | null;
  trialEndsAt: string | null;
  renewsAt: string | null;
  endsAt: string | null;
  testMode: boolean | null;
  updatedAt: string;
}

export interface UserDetail {
  user: AdminUser;
  devices: Device[];
  stats: UserStats;
  purchases: AdminPurchase[];
  subscriptions: AdminSubscription[];
  /** Whether the deploy allows the synthetic-subscription test lab (test mode). */
  testTools?: boolean;
  snapshot: {
    blocklists: unknown;
    sessions: unknown;
    schedules: unknown;
    revision: number;
    updatedAt: string;
  } | null;
  liveSessions: LiveSession[];
  recentEvents: FocusEvent[];
}

// ── test lab: reset test user ─────────────────────────────────────────────────

/**
 * The per-leg report from `POST /admin/test/reset-user`. Honest by design:
 * every leg reports its own outcome, a failed leg appears in `failures`
 * (or `rcSubscriberFailures` for a per-subscriber refusal) with the backend's
 * error verbatim, and `appleSide` is ALWAYS present — the one thing the tool
 * cannot clear is the thing worth saying every single time.
 */
export interface TestResetReport {
  sessionsRevoked: boolean;
  rcSubscribersDeleted: string[];
  rcSubscriberFailures: { appUserId: string; error: string }[];
  lsCancelsEnqueued: number;
  accountDeleted: boolean;
  trialClaimsDeleted: number;
  consumedOrdersDeleted: number;
  failures: { step: string; error: string }[];
  appleSide: string;
}

// ── billing tasks (the cancellation outbox) ───────────────────────────────────

/** One owed provider action from `GET /admin/billing-tasks` (never a settled
 *  one — the route only returns rows whose `doneAt` is still empty). */
export interface BillingTask {
  id: string;
  /** The subscription id AT the provider (Lemon Squeezy). */
  externalId: string;
  /** "cancel" today. */
  kind: string;
  /** Why it is owed — e.g. "account-deleted-by-admin", "admin-cancel". */
  reason: string;
  attempts: number;
  lastError: string | null;
  lockedAt: string | null;
  nextAttemptAt: string;
  createdAt: string;
}

export interface BillingTasksResult {
  /** pending + deadLetter, the one number the badge shows. */
  owed: number;
  /** Still being retried automatically (attempts < maxAttempts). */
  pending: BillingTask[];
  /** Gave up (attempts >= maxAttempts): retried only when a human replays. */
  deadLetter: BillingTask[];
  maxAttempts: number;
}

/** `POST /admin/billing-tasks/drain` — what one manual drain run did. */
export interface DrainReport {
  due: number;
  settled: number;
  contended: number;
  stillOwed: number;
  deadLettered: number;
}

// ── addiction protection ──────────────────────────────────────────────────────

export interface ProtectionEntry {
  id: string;
  category: string;
  kind: "site" | "app";
  value: string;
  label: string | null;
  platform: string | null;
  active: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProtectionListResult {
  entries: ProtectionEntry[];
  total: number;
  skip: number;
  take: number;
}

// ── onboarding funnel telemetry ───────────────────────────────────────────────

/** One visited screen in a run's chronological log. */
export interface FunnelStep {
  step: string;
  enteredAt: string | null;
  leftAt: string | null;
  /** Time spent on the step; null while still on it (or unknown). */
  ms: number | null;
}

export interface FunnelRun {
  runId: string;
  platform: "windows" | "macos";
  deviceId: string | null;
  /** The machine's human name — the card title. */
  deviceName: string | null;
  osVersion: string | null;
  appVersion: string | null;
  funnelVersion: string | null;
  locale: string | null;
  withAccount: boolean | null;
  screenTotal: number | null;
  startedAt: string;
  completedAt: string | null;
  lastSeenAt: string;
  lastStep: string | null;
  /** active = seen in the last 10 min. */
  status: "completed" | "active" | "abandoned";
  /** startedAt -> completedAt (or lastSeenAt). */
  durationMs: number;
  steps: FunnelStep[];
}

export interface FunnelDropoffRow {
  step: string;
  reached: number;
  droppedHere: number;
}

export interface FunnelSummary {
  started: number;
  completed: number;
  active: number;
  abandoned: number;
  medianDurationMs: number | null;
  /** Walk order. */
  dropoff: FunnelDropoffRow[];
}

export interface FunnelResult {
  /** Sorted lastSeenAt desc. */
  runs: FunnelRun[];
  summary: FunnelSummary;
  windowDays: number;
  /** Canonical walk order incl. platform-specific tails ("verify" win, "permissions" mac). */
  stepOrder: string[];
}

export interface ProtectionLock {
  id: string;
  userId: string;
  active: boolean;
  method: "partner" | "date";
  categories: string[];
  partnerContact: string | null;
  otp: string | null;
  otpSentAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { email: string; status: string | null };
}
