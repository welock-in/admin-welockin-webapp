import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import type { AdminUser } from "@/lib/types";

/** Platform grants are separate from the global entitlement cache and billing. */
export default function SignupLifetimeGrants({ user }: { user: AdminUser }) {
  const scopes = [
    { key: "ios", label: "iOS / iPadOS", grantedAt: user.iosLifetimeGrantedAt },
    { key: "desktop", label: "Windows + macOS", grantedAt: user.desktopLifetimeGrantedAt },
  ];
  const visible = scopes.filter(({ key, grantedAt }) => grantedAt || user.signupLifetimeOffer === key);
  if (visible.length === 0) return null;

  return (
    <section aria-label="Signup lifetime offers" className="rounded-xl border border-black/10 p-4 mb-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">Lifetime on the house</h3>
      <div className="space-y-3">
        {visible.map(({ key, label, grantedAt }) => (
          <div key={key}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-ink">{label}</span>
              <Badge tone={user.accessRevoked ? "red" : grantedAt ? "green" : "amber"}>
                {user.accessRevoked ? "Access revoked" : grantedAt ? "Lifetime granted" : "Reserved"}
              </Badge>
            </div>
            <p className="text-xs text-muted mt-1">
              {grantedAt
                ? `Granted ${fmtDate(grantedAt)} · no expiry.`
                : `Reserved at signup ${fmtDate(user.createdAt)} · ${user.emailVerified ? "grant not recorded" : "awaiting email verification"}.`}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-3">
        These offers apply only to the platforms shown. Turning off future offers does not remove them.
        {user.accessRevoked ? " The account revocation blocks access." : ""}
        {visible.some(({ grantedAt }) => !grantedAt) ? " Pending offers activate after email verification." : ""}
        {" "}Existing subscriptions are not cancelled and may still renew.
      </p>
    </section>
  );
}
