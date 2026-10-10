import clsx from "clsx";
import type { Stakeholder, StakeholderReview } from "@/lib/types";

// PR-reviewer-style row: who, their decision, and their written rationale.
export function ReviewerRow({ review, stakeholder }: { review: StakeholderReview; stakeholder?: Stakeholder }) {
  const decisionStyle = {
    approve: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
    reject: "bg-red-500/20 text-red-300 border-red-400/30",
    pending: "bg-neutral-700 text-neutral-400 border-neutral-600",
  }[review.decision];

  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ backgroundColor: stakeholder?.avatarColor ?? "#555" }}
      >
        {(stakeholder?.name ?? "?").slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-neutral-200">{stakeholder?.name ?? "Unknown"}</span>
          <span className="text-[11px] text-neutral-500">{stakeholder?.expertise.replace(/_/g, " ")}</span>
          <span className={clsx("ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", decisionStyle)}>
            {review.decision}
          </span>
        </div>
        {review.expertOpinion ? (
          <p className="mt-1 text-xs text-neutral-400">{review.expertOpinion}</p>
        ) : (
          <p className="mt-1 text-xs italic text-neutral-600">Awaiting response…</p>
        )}
      </div>
    </div>
  );
}
