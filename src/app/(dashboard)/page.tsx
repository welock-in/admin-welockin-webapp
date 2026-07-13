import { redirect } from "next/navigation";
import { backendGet, BackendError } from "@/lib/backend";
import type { Overview } from "@/lib/types";
import { fmtHours, fmtNumber } from "@/lib/format";
import { Card, PageHeader, StatCard } from "@/components/ui";
import LiveSessions from "@/components/LiveSessions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let data: Overview;
  try {
    data = await backendGet<Overview>("/admin/overview");
  } catch (e) {
    if (e instanceof BackendError && e.status === 401) redirect("/login");
    return (
      <div className="p-8">
        <PageHeader title="Dashboard" />
        <Card className="p-6">
          <p className="text-sm text-accent font-medium">
            Couldn’t reach the backend: {e instanceof Error ? e.message : "unknown error"}
          </p>
          <p className="text-sm text-muted mt-2">
            Check <code className="bg-black/5 px-1 rounded">BACKEND_API_URL</code> and that the backend is
            deployed with the admin routes.
          </p>
        </Card>
      </div>
    );
  }

  const plans = Object.entries(data.usersByPlan).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-8">
      <PageHeader title="Dashboard" subtitle="Real-time activity across WeLockin." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <StatCard label="Live now" value={fmtNumber(data.liveSessionsCount)} accent sub="focusing right now" />
        <StatCard label="Total users" value={fmtNumber(data.totalUsers)} sub={`${data.suspendedUsers} suspended`} />
        <StatCard label="Total sessions" value={fmtNumber(data.totalSessions)} sub={`${fmtNumber(data.sessionsToday)} today`} />
        <StatCard label="Focus time" value={fmtHours(data.totalFocusSeconds)} sub="all-time" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Active (7d)" value={fmtNumber(data.activeUsers7d)} sub={`${fmtNumber(data.activeUsers30d)} in 30d`} />
        <StatCard label="New users (7d)" value={fmtNumber(data.newUsers7d)} sub={`${fmtNumber(data.newUsers30d)} in 30d`} />
        <StatCard label="Sessions (7d)" value={fmtNumber(data.sessions7d)} sub={`${fmtHours(data.focusSeconds7d)} focused`} />
        <StatCard label="Devices" value={fmtNumber(data.totalDevices)} sub="registered" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <LiveSessions />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-ink mb-3">Plans</h2>
          {plans.length === 0 ? (
            <p className="text-sm text-muted">No users yet.</p>
          ) : (
            <div className="space-y-2.5">
              {plans.map(([plan, count]) => {
                const share = data.totalUsers > 0 ? count / data.totalUsers : 0;
                return (
                  <div key={plan}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-ink">{plan}</span>
                      <span className="text-muted">{fmtNumber(count)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${Math.round(share * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
