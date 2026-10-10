"use client";

import { useState } from "react";
import type { AuditLogEntry } from "@/lib/types";
import clsx from "clsx";

const ACTOR: Record<AuditLogEntry["actor"]["type"], { dot: string; chip: string; label: string }> = {
  ai: { dot: "bg-bmw-blue", chip: "bg-[#eef4fc] text-bmw-blue", label: "Copilot" },
  pm: { dot: "bg-neutral-900", chip: "bg-neutral-100 text-neutral-800", label: "PM" },
  stakeholder: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800", label: "Stakeholder" },
};

// Append-only decision trail. This is the single source of truth every
// AI summary on the page is (eventually, for real) generated from —
// US-8.1 through US-8.5.
export function AuditLogPanel({ entries }: { entries: AuditLogEntry[] }) {
  const [actorFilter, setActorFilter] = useState<"all" | AuditLogEntry["actor"]["type"]>("all");
  const sorted = [...entries]
    .filter((e) => actorFilter === "all" || e.actor.type === actorFilter)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex border border-neutral-200 p-0.5">
        {(["all", "ai", "pm", "stakeholder"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActorFilter(f)}
            className={clsx(
              "flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors",
              actorFilter === f ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900",
            )}
          >
            {f === "all" ? "All" : ACTOR[f].label}
          </button>
        ))}
      </div>
      <ol className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {sorted.map((entry) => {
          const a = ACTOR[entry.actor.type];
          return (
            <li key={entry.id} className="group relative pb-5 pl-6 last:pb-0">
              <span className="absolute -bottom-1 left-[5px] top-3 w-px bg-neutral-200 group-last:hidden" />
              <span className={clsx("absolute left-0 top-1 h-[11px] w-[11px] rounded-full ring-4 ring-white", a.dot)} />
              <div className="flex items-center justify-between gap-2">
                <span className={clsx("px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]", a.chip)}>{a.label}</span>
                <time className="text-[11px] tabular-nums text-neutral-400">
                  {new Date(entry.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
              <p className="mt-1.5 text-[13px] text-neutral-900">
                <span className="font-medium">{entry.actor.name}</span>
                <span className="text-neutral-500"> {formatAction(entry.action)}</span>
              </p>
              {entry.rationale && <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">{entry.rationale}</p>}
            </li>
          );
        })}
        {sorted.length === 0 && <p className="text-[13px] text-neutral-400">No activity logged yet.</p>}
      </ol>
    </div>
  );
}

function formatAction(action: AuditLogEntry["action"]) {
  return action.replace(/_/g, " ");
}
