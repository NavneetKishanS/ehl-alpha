"use client";

import { useState } from "react";
import type { AuditLogEntry } from "@/lib/types";
import clsx from "clsx";

const ACTOR_COLOR: Record<AuditLogEntry["actor"]["type"], string> = {
  ai: "text-violet-300 border-violet-700",
  pm: "text-sky-300 border-sky-700",
  stakeholder: "text-amber-300 border-amber-700",
};

const ACTOR_BAR: Record<AuditLogEntry["actor"]["type"], string> = {
  ai: "border-l-violet-600",
  pm: "border-l-sky-600",
  stakeholder: "border-l-amber-600",
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
    <div className="flex h-full flex-col">
      <div className="mb-2 flex gap-1">
        {(["all", "ai", "pm", "stakeholder"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActorFilter(f)}
            className={clsx(
              "border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              actorFilter === f ? "border-neutral-500 bg-neutral-800 text-neutral-200" : "border-neutral-800 text-neutral-600 hover:text-neutral-400",
            )}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {sorted.map((entry) => (
          <div key={entry.id} className={clsx("border-l-2 bg-neutral-900/60 p-2 text-[11px]", ACTOR_BAR[entry.actor.type])}>
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <span className={clsx("border px-1 text-[9px] font-semibold uppercase tracking-wide", ACTOR_COLOR[entry.actor.type])}>
                {entry.actor.type}
              </span>
              <span className="font-mono text-[10px] text-neutral-600">
                {new Date(entry.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="font-medium text-neutral-300">
              {entry.actor.name}
              <span className="font-normal text-neutral-600"> — {formatAction(entry.action)}</span>
            </div>
            {entry.rationale && <p className="mt-0.5 text-neutral-500">{entry.rationale}</p>}
          </div>
        ))}
        {sorted.length === 0 && <p className="text-xs text-neutral-600">No activity logged yet.</p>}
      </div>
    </div>
  );
}

function formatAction(action: AuditLogEntry["action"]) {
  return action.replace(/_/g, " ");
}
