import type { EvidenceLevel } from "@/lib/types";
import clsx from "clsx";

const LABEL: Record<EvidenceLevel, string> = {
  strong: "Strong evidence",
  moderate: "Moderate evidence",
  weak: "Weak evidence",
};

const DOT: Record<EvidenceLevel, string> = {
  strong: "bg-evidence-strong",
  moderate: "bg-evidence-moderate",
  weak: "bg-evidence-weak",
};

export function EvidenceBadge({ level, className }: { level: EvidenceLevel; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-neutral-200",
        className,
      )}
      title={`${LABEL[level]} — derived from source reliability and sample size`}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", DOT[level])} />
      {LABEL[level]}
    </span>
  );
}
