import clsx from "clsx";
import type { Stakeholder, StakeholderReview } from "@/lib/types";

// PR-reviewer-style row: who, their decision, and their written rationale.
export function ReviewerRow({ review, stakeholder }: { review: StakeholderReview; stakeholder?: Stakeholder }) {
  const decisionStyle = {
    approve: "border-emerald-800 text-emerald-300",
    reject: "border-red-800 text-red-300",
    pending: "border-neutral-700 text-neutral-500",
  }[review.decision];

  return (
    <div className="flex items-start gap-2.5 border border-neutral-800 bg-neutral-900/60 p-2.5">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[10px] font-bold text-white"
        style={{ backgroundColor: stakeholder?.avatarColor ?? "#555" }}
      >
        {(stakeholder?.name ?? "?").slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-neutral-200">{stakeholder?.name ?? "Unknown"}</span>
          <span className="text-[10px] uppercase tracking-wide text-neutral-600">{stakeholder?.expertise.replace(/_/g, " ")}</span>
          <span className={clsx("ml-auto border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", decisionStyle)}>
            {review.decision}
          </span>
        </div>
        {review.expertOpinion ? (
          <p className="mt-1 text-[11px] text-neutral-400">{review.expertOpinion}</p>
        ) : (
          <p className="mt-1 text-[11px] italic text-neutral-600">Awaiting response…</p>
        )}
      </div>
    </div>
  );
}
