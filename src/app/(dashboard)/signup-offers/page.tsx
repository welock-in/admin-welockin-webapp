import { PageHeader } from "@/components/ui";
import SignupLifetimeSettings from "@/components/SignupLifetimeSettings";

export const dynamic = "force-dynamic";

export default function SignupOffersPage() {
  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="Signup offers"
        subtitle="Offer lifetime access to future signups after email verification."
      />
      <SignupLifetimeSettings />
    </div>
  );
}
