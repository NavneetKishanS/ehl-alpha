import clsx from "clsx";
import { StakeholderAvatar } from "@/components/StakeholderAvatar";
import { expertiseLabel, splitStakeholderName } from "@/lib/stakeholderName";
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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-medium leading-snug text-neutral-900">{stakeholder ? splitStakeholderName(stakeholder.name).person : "Unknown"}</p>
            {stakeholder && (
              <p className="text-[12px] capitalize leading-snug text-neutral-400">
                {splitStakeholderName(stakeholder.name).role ?? expertiseLabel(stakeholder.expertise)}
              </p>
            )}
          </div>
          <span className={clsx("shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]", decision.chip)}>{decision.label}</span>
        </div>
        {review.expertOpinion ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">{review.expertOpinion}</p>
        ) : (
          <p className="mt-1.5 text-[12px] text-neutral-500">Awaiting response</p>
        )}
      </div>
    </div>
  );
}
