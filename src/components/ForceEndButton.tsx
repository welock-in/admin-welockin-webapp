"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";

export default function ForceEndButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function forceEnd() {
    setBusy(true);
    try {
      await apiSend(`admin/live-sessions/${id}/force-end`, "POST");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={forceEnd}
      disabled={busy || disabled}
      className="rounded-lg border border-white/30 text-white text-xs font-semibold px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? "…" : disabled ? "Ending…" : "Force end"}
    </button>
  );
}
