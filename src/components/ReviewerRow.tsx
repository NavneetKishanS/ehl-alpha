import clsx from "clsx";
import { StakeholderAvatar } from "@/components/StakeholderAvatar";
import type { Stakeholder, StakeholderReview } from "@/lib/types";

// PR-reviewer-style row: who, their decision, and their written rationale.
export function ReviewerRow({ review, stakeholder }: { review: StakeholderReview; stakeholder?: Stakeholder }) {
  const decision = {
    approve: { chip: "bg-emerald-50 text-emerald-700", label: "Approved" },
    reject: { chip: "bg-red-50 text-red-700", label: "Rejected" },
    pending: { chip: "bg-neutral-100 text-neutral-500", label: "Pending" },
  }[review.decision];

  return (
    <div className="flex items-start gap-3 border-b border-neutral-100 py-3 last:border-b-0">
      <StakeholderAvatar stakeholder={stakeholder} size={36} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-medium text-neutral-900">{stakeholder?.name ?? "Unknown"}</span>
          {stakeholder && !stakeholder.name.includes("—") && (
            <span className="text-[11px] capitalize text-neutral-400">{stakeholder.expertise.replace(/_/g, " ")}</span>
          )}
          <span className={clsx("ml-auto px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]", decision.chip)}>{decision.label}</span>
        </div>
        {review.expertOpinion ? (
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{review.expertOpinion}</p>
        ) : (
          <p className="mt-1 text-[12px] text-neutral-500">Awaiting response</p>
        )}
      </div>
    </div>
  );
}
