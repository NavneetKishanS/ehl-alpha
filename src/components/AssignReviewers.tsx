"use client";

import { useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api-client";
import type { Stakeholder, StakeholderReview } from "@/lib/types";

// Lets a PM tag specific stakeholders to review a requirement, live — the
// runtime counterpart to the reviews seeded at ingest time. Skips anyone
// already assigned (the API is idempotent on that), and only shows people
// not already on the requirement so the picker doesn't fill up with no-ops.
export function AssignReviewers({
  requirementId,
  allStakeholders,
  existingReviews,
  onAssigned,
}: {
  requirementId: string;
  allStakeholders: Stakeholder[];
  existingReviews: StakeholderReview[];
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const assignedIds = new Set(existingReviews.filter((r) => r.requirementId === requirementId).map((r) => r.stakeholderId));
  const available = allStakeholders.filter((s) => !assignedIds.has(s.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function send() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await api.assignReviewers(requirementId, [...selected]);
      setSelected(new Set());
      setOpen(false);
      onAssigned();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        disabled={available.length === 0}
        className="mt-2 text-[12px] font-medium text-bmw-blue underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
      >
        {available.length === 0 ? "All stakeholders already tagged" : "+ Tag reviewers"}
      </button>
    );
  }

  return (
    <div className="mt-2 border border-neutral-200 bg-neutral-50 p-3" onClick={(e) => e.stopPropagation()}>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Send to review</p>
      <div className="flex flex-wrap gap-2">
        {available.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className={clsx(
              "flex items-center gap-1.5 border px-2.5 py-1.5 text-[12px] transition-colors",
              selected.has(s.id) ? "border-bmw-blue bg-[#eef4fc] text-bmw-blue" : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900",
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: s.avatarColor }}>
              {s.name.slice(0, 1)}
            </span>
            {s.name.split(" — ")[0]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={send}
          disabled={selected.size === 0 || busy}
          className="bg-bmw-blue px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#0653b6] disabled:opacity-40"
        >
          {busy ? "Sending…" : `Send to ${selected.size || ""} reviewer${selected.size === 1 ? "" : "s"}`.trim()}
        </button>
        <button onClick={() => setOpen(false)} className="text-[12px] text-neutral-500 hover:text-neutral-900">
          Cancel
        </button>
      </div>
    </div>
  );
}
