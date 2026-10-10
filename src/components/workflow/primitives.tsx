import clsx from "clsx";
import type { Requirement, EvidenceLevel } from "@/lib/types";

// Small shared building blocks for the (light-themed) workflow page and
// RequirementCard, so both describe the same visual language once instead
// of each hand-rolling chips/meters/rings.

export function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={clsx("px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]", className)}>
      {children}
    </span>
  );
}

export const STATUS_CHIP: Record<Requirement["status"], string> = {
  proposed: "bg-neutral-100 text-neutral-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  postponed: "bg-amber-50 text-amber-800",
  challenged: "bg-violet-50 text-violet-700",
};

// snake_case / kebab-case -> "space separated" (callers apply uppercase or
// sentence-case via CSS as needed — this just normalizes the separators).
export function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ");
}

const EVIDENCE_STYLE: Record<EvidenceLevel, { dot: string; text: string; label: string }> = {
  strong: { dot: "bg-emerald-500", text: "text-emerald-700", label: "Strong evidence" },
  moderate: { dot: "bg-amber-500", text: "text-amber-700", label: "Moderate evidence" },
  weak: { dot: "bg-red-500", text: "text-red-700", label: "Weak evidence" },
};

export function EvidenceMeter({ level }: { level: EvidenceLevel }) {
  const s = EVIDENCE_STYLE[level];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-[11px] font-medium", s.text)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

// Compact circular score readout. `dirty` (unsaved weight changes pending)
// swaps the ring to a dashed outline so a PM never mistakes a live preview
// for the saved score.
export function ScoreRing({ score, dirty }: { score: number; dirty?: boolean }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = 24;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="#e5e5e5" strokeWidth="4" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={dirty ? "#9ca3af" : "#1c69d4"}
          strokeWidth="4"
          strokeDasharray={dirty ? "4 3" : c}
          strokeDashoffset={dirty ? 0 : offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute font-mono text-[14px] font-semibold tabular-nums text-neutral-900">{pct.toFixed(0)}</span>
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-light tracking-tight text-neutral-900">{title}</h2>
      </div>
      {aside}
    </div>
  );
}
