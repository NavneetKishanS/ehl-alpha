"use client";

import clsx from "clsx";
import type { Requirement, Stakeholder, StakeholderReview } from "@/lib/types";

// At-a-glance reviewer x requirement grid — the thing a PM actually wants
// before clicking into any one requirement's detail panel: "who still owes
// me a decision, and where do my reviewers disagree." Click a cell or row
// to select that requirement in the detail panel below (reuses the same
// selectedReqId state the requirement cards already drive).
export function StakeholderMatrix({
  requirements,
  reviews,
  stakeholders,
  selectedReqId,
  onSelectRequirement,
}: {
  requirements: Requirement[];
  reviews: StakeholderReview[];
  stakeholders: Stakeholder[];
  selectedReqId: string | null;
  onSelectRequirement: (id: string) => void;
}) {
  if (reviews.length === 0) return null;

  const involvedStakeholderIds = new Set(reviews.map((r) => r.stakeholderId));
  const columns = stakeholders.filter((s) => involvedStakeholderIds.has(s.id));
  if (columns.length === 0) return null;

  const reviewAt = (reqId: string, stakeholderId: string) =>
    reviews.find((r) => r.requirementId === reqId && r.stakeholderId === stakeholderId);

  const pendingCount = reviews.filter((r) => r.decision === "pending").length;

  return (
    <section className="border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Review status across all requirements
        </h2>
        <span className="font-mono text-[10px] text-neutral-600">
          {reviews.length - pendingCount}/{reviews.length} decided
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-wide text-neutral-500">
              <th className="py-1.5 pr-3 font-medium">Requirement</th>
              {columns.map((s) => (
                <th key={s.id} className="px-2 py-1.5 text-center font-medium" title={s.name}>
                  <span
                    className="mx-auto flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ backgroundColor: s.avatarColor }}
                  >
                    {s.name.slice(0, 1)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requirements.map((req) => {
              const rowReviews = columns.map((s) => reviewAt(req.id, s.id));
              const hasAnyReview = rowReviews.some(Boolean);
              if (!hasAnyReview) return null;
              return (
                <tr
                  key={req.id}
                  onClick={() => onSelectRequirement(req.id)}
                  className={clsx(
                    "cursor-pointer border-b border-neutral-900 hover:bg-neutral-800/50",
                    selectedReqId === req.id && "bg-neutral-800/70",
                  )}
                >
                  <td className="max-w-[16rem] truncate py-1.5 pr-3 text-neutral-300" title={req.title}>
                    {req.title}
                  </td>
                  {columns.map((s) => {
                    const review = reviewAt(req.id, s.id);
                    return (
                      <td key={s.id} className="px-2 py-1.5 text-center">
                        <DecisionDot review={review} stakeholderName={s.name} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DecisionDot({ review, stakeholderName }: { review?: StakeholderReview; stakeholderName: string }) {
  if (!review) {
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-800" title={`${stakeholderName}: not asked`} />;
  }
  const style = {
    approve: "bg-emerald-500",
    reject: "bg-red-500",
    pending: "bg-amber-500/70 ring-1 ring-amber-400/50",
  }[review.decision];
  const title = `${stakeholderName}: ${review.decision}${review.expertOpinion ? ` — ${review.expertOpinion.slice(0, 80)}` : ""}`;
  return <span className={clsx("inline-block h-2.5 w-2.5 rounded-full", style)} title={title} />;
}
