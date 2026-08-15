import Shell from "@/components/Shell";
import { backendGet } from "@/lib/backend";
import type { BillingTasksResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Initial dead-letter count for the nav badge. Best-effort on purpose: an
  // unreachable backend (or an expired session) must not take the whole shell
  // down — the pages inside handle those errors with real messages, and the
  // Shell re-polls the count client-side anyway.
  let deadLetters = 0;
  try {
    const tasks = await backendGet<BillingTasksResult>("/admin/billing-tasks");
    deadLetters = tasks.deadLetter.length;
  } catch {
    /* badge only — never fatal */
  }
  return <Shell initialDeadLetters={deadLetters}>{children}</Shell>;
}
