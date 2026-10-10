import type { EvidenceLevel } from "@/lib/types";
import clsx from "clsx";

const LABEL: Record<EvidenceLevel, string> = {
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
};

const STYLE: Record<EvidenceLevel, string> = {
  strong: "border-emerald-800 text-emerald-300",
  moderate: "border-amber-800 text-amber-300",
  weak: "border-red-800 text-red-300",
};

const DOT: Record<EvidenceLevel, string> = {
  strong: "bg-emerald-500",
  moderate: "bg-amber-500",
  weak: "bg-red-500",
};

export function EvidenceBadge({ level, className }: { level: EvidenceLevel; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STYLE[level],
        className,
      )}
      title={`${LABEL[level]} evidence — derived from source reliability and sample size`}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", DOT[level])} />
      {LABEL[level]}
    </span>
  );
}
