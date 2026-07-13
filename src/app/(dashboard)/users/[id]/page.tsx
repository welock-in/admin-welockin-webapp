import { redirect } from "next/navigation";
import { backendGet, BackendError } from "@/lib/backend";
import type { UserDetail } from "@/lib/types";
import { fmtDuration, fmtDate, fmtDateShort, fmtClock, pct, fmtNumber, timeAgo } from "@/lib/format";
import { Card, PageHeader, StatCard, Badge, SectionTitle, BackLink } from "@/components/ui";
import { BarChart } from "@/components/Charts";
import UserModeration from "@/components/UserModeration";
import ForceEndButton from "@/components/ForceEndButton";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function count(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  let d: UserDetail;
  try {
    d = await backendGet<UserDetail>(`/admin/users/${params.id}`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 401) redirect("/login");
    return (
      <div className="p-8">
        <BackLink href="/users">Back to profiles</BackLink>
        <Card className="p-6 mt-4">
          <p className="text-sm text-accent font-medium">
            {e instanceof BackendError && e.status === 404 ? "User not found." : "Failed to load profile."}
          </p>
        </Card>
      </div>
    );
  }

  const { user, stats, devices, liveSessions, recentEvents, snapshot } = d;
  const suspended = user.status === "suspended";

  const focusDays = stats.focusByDay.map((x) => ({ label: x.day.slice(5), value: x.seconds }));
  const weekdayData = stats.sessionsByWeekday.map((v, i) => ({ label: WEEKDAYS[i], value: v }));

  return (
    <div className="p-8">
      <BackLink href="/users">Back to profiles</BackLink>

      <PageHeader
        title={user.email}
        subtitle={`Joined ${fmtDateShort(user.createdAt)} · ID ${user.id}`}
        right={<UserModeration userId={user.id} status={user.status ?? "active"} plan={user.plan} email={user.email} />}
      />

      <div className="flex items-center gap-2 -mt-3 mb-5">
        <Badge tone={suspended ? "red" : "green"}>{suspended ? "suspended" : "active"}</Badge>
        <Badge tone="ink">
          <span className="capitalize">{user.plan}</span>
        </Badge>
        {user.emailVerified ? <Badge tone="green">email verified</Badge> : <Badge tone="amber">unverified</Badge>}
        {liveSessions.length > 0 && <Badge tone="green">live now</Badge>}
      </div>

      {liveSessions.length > 0 && (
        <div className="mb-6 rounded-2xl bg-ink text-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-sm font-bold">Focusing now</span>
          </div>
          <div className="space-y-2">
            {liveSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{s.name}</span>
                  {s.hardLock && <Badge tone="red">hard lock</Badge>}
                  {s.phase === "break" && <Badge tone="amber">break</Badge>}
                  <span className="text-white/60">
                    on {s.deviceName ?? s.platform ?? "device"} · {fmtClock(s.remainSeconds)} left · beat {timeAgo(s.lastHeartbeatAt)}
                  </span>
                </div>
                <ForceEndButton id={s.id} disabled={s.forceEnd} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <StatCard label="Total sessions" value={fmtNumber(stats.totalSessions)} sub={`${stats.abortedSessions} aborted`} />
        <StatCard label="Completion" value={pct(stats.completionRate)} sub={`${stats.completedSessions} completed`} />
        <StatCard label="Focus time" value={fmtDuration(stats.totalFocusSeconds)} accent sub="all-time" />
        <StatCard label="Avg length" value={fmtDuration(stats.avgSessionSeconds)} sub="per session" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Current streak" value={`${stats.currentStreak}d`} sub={`best ${stats.longestStreak}d`} />
        <StatCard label="Hard locks" value={fmtNumber(stats.hardLockSessions)} sub="sessions" />
        <StatCard label="Apps killed" value={fmtNumber(stats.totalKilled)} sub={`${stats.emergencyUsedCount} emergencies`} />
        <StatCard label="Active days" value={fmtNumber(stats.activeDays)} sub={`${stats.sessionsLast7d} in 7d`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle>Focus — last 30 days</SectionTitle>
          {stats.totalSessions === 0 ? (
            <p className="text-sm text-muted">No sessions yet.</p>
          ) : (
            <BarChart data={focusDays} format={(v) => fmtDuration(v)} />
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle>By weekday</SectionTitle>
          <BarChart data={weekdayData} color="#1a1714" />
        </Card>
      </div>

      {/* Devices + Account */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <SectionTitle>Devices ({devices.length})</SectionTitle>
          {devices.length === 0 ? (
            <p className="text-sm text-muted">No devices registered.</p>
          ) : (
            <div className="space-y-2">
              {devices.map((dev) => (
                <div key={dev.id} className="flex items-center justify-between text-sm border-b border-black/[0.04] pb-2 last:border-0">
                  <div>
                    <div className="font-medium text-ink">{dev.name}</div>
                    <div className="text-xs text-muted">
                      {[dev.kind, dev.platform, dev.osVersion, dev.appVersion && `app ${dev.appVersion}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <span className="text-xs text-muted">{timeAgo(dev.lastSeenAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Account</SectionTitle>
          <dl className="text-sm space-y-2">
            <Row k="First session" v={fmtDate(stats.firstSessionAt)} />
            <Row k="Last session" v={fmtDate(stats.lastSessionAt)} />
            <Row k="Trial ends" v={user.trialEndsAt ? fmtDate(user.trialEndsAt) : "—"} />
            <Row k="Blocklists" v={snapshot ? String(count(snapshot.blocklists)) : "0"} />
            <Row k="Saved sessions" v={snapshot ? String(count(snapshot.sessions)) : "0"} />
            <Row k="Schedule blocks" v={snapshot ? String(count(snapshot.schedules)) : "0"} />
            <Row k="Synced" v={snapshot ? `rev ${snapshot.revision} · ${timeAgo(snapshot.updatedAt)}` : "never"} />
          </dl>
          {stats.topSessionNames.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Top sessions</div>
              <div className="flex flex-wrap gap-1.5">
                {stats.topSessionNames.map((t) => (
                  <span key={t.name} className="rounded-full bg-black/5 px-2.5 py-1 text-xs text-ink">
                    {t.name} <span className="text-muted">×{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Recent history */}
      <Card className="p-5">
        <SectionTitle>Recent sessions</SectionTitle>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-muted">No history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-black/5">
                  <th className="py-2 pr-3 font-semibold">Session</th>
                  <th className="py-2 pr-3 font-semibold">Started</th>
                  <th className="py-2 pr-3 font-semibold text-right">Duration</th>
                  <th className="py-2 pr-3 font-semibold text-right">Killed</th>
                  <th className="py-2 pr-3 font-semibold">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((ev) => {
                  const dur = Math.max(0, Math.floor((new Date(ev.endedAt).getTime() - new Date(ev.startedAt).getTime()) / 1000));
                  return (
                    <tr key={ev.id} className="border-b border-black/[0.04]">
                      <td className="py-2.5 pr-3">
                        <span className="text-ink">{ev.name}</span>{" "}
                        {ev.hardLock && <Badge tone="red">hard</Badge>}
                      </td>
                      <td className="py-2.5 pr-3 text-muted">{fmtDate(ev.startedAt)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink">{fmtDuration(dur)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-muted">{ev.killedTotal}</td>
                      <td className="py-2.5 pr-3">
                        {ev.completed ? <Badge tone="green">completed</Badge> : <Badge tone="amber">ended early</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-ink text-right">{v}</dd>
    </div>
  );
}
