import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-black/5 rounded-2xl shadow-sm ${className}`}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-2xl font-bold mt-1.5 ${accent ? "text-accent" : "text-ink"}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </Card>
  );
}

const badgeTone: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  gray: "bg-black/5 text-[#5b5448]",
  ink: "bg-ink text-white",
};

export function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: keyof typeof badgeTone;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeTone[tone]}`}>
      {children}
    </span>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-ink mb-3">{children}</h2>;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {children}
    </Link>
  );
}
