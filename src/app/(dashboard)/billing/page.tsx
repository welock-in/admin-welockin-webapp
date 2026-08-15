import { PageHeader } from "@/components/ui";
import BillingTasks from "@/components/BillingTasks";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="Billing tasks"
        subtitle="Cancellations still owed to Lemon Squeezy — dead-letters need a human."
      />
      <BillingTasks />
    </div>
  );
}
