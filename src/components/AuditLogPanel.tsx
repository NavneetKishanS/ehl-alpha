"use client";

import type { AuditLogEntry } from "@/lib/types";
import clsx from "clsx";

const ACTOR_COLOR: Record<AuditLogEntry["actor"]["type"], string> = {
  ai: "text-violet-300 border-violet-400/30 bg-violet-500/10",
  pm: "text-sky-300 border-sky-400/30 bg-sky-500/10",
  stakeholder: "text-amber-300 border-amber-400/30 bg-amber-500/10",
};

// Append-only decision trail. This is the single source of truth every
// AI summary on the page is (eventually, for real) generated from —
// US-8.1 through US-8.5.
export function AuditLogPanel({ entries }: { entries: AuditLogEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      {sorted.map((entry) => (
        <div key={entry.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                ACTOR_COLOR[entry.actor.type],
              )}
            >
              {entry.actor.type}
            </span>
            <span className="text-[11px] text-neutral-500">
              {new Date(entry.timestamp).toLocaleString()}
            </span>
          </div>
          <div className="font-medium text-neutral-200">
            {entry.actor.name}
            <span className="font-normal text-neutral-500"> — {formatAction(entry.action)}</span>
          </div>
          {entry.rationale && <p className="mt-1 text-neutral-400">{entry.rationale}</p>}
        </div>
      ))}
      {sorted.length === 0 && <p className="text-sm text-neutral-500">No activity logged yet.</p>}
    </div>
  );
}

function formatAction(action: AuditLogEntry["action"]) {
  return action.replace(/_/g, " ");
}
