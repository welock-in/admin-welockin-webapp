import { BarChart } from "@/components/Charts";
import { Card } from "@/components/ui";
import { fmtNumber } from "@/lib/format";
import type { ReferralsSummary } from "@/lib/types";

/**
 * Arrivals from a printed link — today, the QR code on the flyers.
 *
 * `null` means the backend could not answer, which is a different thing from
 * zero and has to look different: a deployment that predates the endpoint would
 * otherwise render a confident "0 scans" and be believed.
 */
export function Referrals({ data }: { data: ReferralsSummary | null }) {
  if (!data) {
    return (
      <Card className="p-5">
        <Header />
        <p className="text-sm text-muted mt-3">
          The backend has no <code className="bg-black/5 px-1 rounded">/admin/referrals</code> endpoint
          yet — deploy it to start counting.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <Header />
      <div className="mt-4 space-y-6">
        {data.sources.map((s) => (
          <div key={s.source}>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-ink">{fmtNumber(s.total)}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mt-0.5">
                  {s.source} · all-time
                </div>
              </div>
              <div className="text-right text-sm text-muted">
                <div>
                  <span className="text-ink font-semibold">{fmtNumber(s.today)}</span> today
                </div>
                <div>
                  <span className="text-ink font-semibold">{fmtNumber(s.last7d)}</span> in 7 days
                </div>
              </div>
            </div>

            <div className="mt-3">
              <BarChart
                data={s.days.map((d) => ({ label: d.day.slice(5), value: d.count }))}
                height={80}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Header() {
  return (
    <div>
      <h2 className="text-sm font-bold text-ink">Where they came from</h2>
      {/* Said here rather than left to be rediscovered: the endpoint behind this
          is public by necessity — the people it counts have no account — and the
          figure is deduplicated per browser session, so it is closer to "people
          who scanned" than to page loads, and it is not audited. A campaign
          signal, nothing to decide money on. */}
      <p className="text-xs text-muted mt-1">
        Scans that opened the site, one per browser session. A campaign signal, not an audited figure.
      </p>
    </div>
  );
}
