import type { DurationQuality as Quality } from "@/lib/types";
import { fmtDuration, fmtNumber } from "@/lib/format";

export default function DurationQuality({ quality }: { quality?: Quality }) {
  if (!quality) return <p className="text-xs text-muted mb-4">Duration provenance is unavailable on this backend version.</p>;
  return <p className="text-xs text-muted mb-4">
    Measured focus: {fmtDuration(quality.measuredSeconds)} ({fmtNumber(quality.measuredEvents)} sessions).
    {" "}Estimated from older sessions: {fmtDuration(quality.estimatedSeconds)} ({fmtNumber(quality.estimatedEvents)} sessions).
    {quality.unavailableEvents > 0 && <> {fmtNumber(quality.unavailableEvents)} sessions have no reliable duration and add no focus time.</>}
  </p>;
}
