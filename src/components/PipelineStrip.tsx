"use client";

import clsx from "clsx";
import type { Stage } from "@/lib/types";

const STATUS_STYLE: Record<Stage["status"], string> = {
  pending: "bg-neutral-700 border-neutral-600",
  active: "bg-amber-500 border-amber-400 animate-pulse",
  complete: "bg-emerald-500 border-emerald-400",
  blocked: "bg-red-500 border-red-400",
  skipped: "bg-neutral-800 border-neutral-700",
};

// A GitHub-Actions-style strip of pipeline stages. Hovering a dot shows the
// stage label, owner (ai/pm/stakeholder) and timestamps.
export function PipelineStrip({ stages }: { stages: Stage[] }) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex min-w-max items-center">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center">
            <div className="group relative flex flex-col items-center">
              <div
                className={clsx(
                  "h-5 w-5 rounded-full border-2 transition-transform group-hover:scale-110",
                  STATUS_STYLE[stage.status],
                )}
              />
              <span className="mt-2 w-24 text-center text-[11px] leading-tight text-neutral-400">
                {stage.label}
              </span>
              <div className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-xs shadow-xl group-hover:block">
                <div className="font-semibold text-neutral-100">{stage.label}</div>
                <div className="text-neutral-400">status: {stage.status} · owner: {stage.owner}</div>
                {stage.startedAt && (
                  <div className="text-neutral-500">started {new Date(stage.startedAt).toLocaleString()}</div>
                )}
                {stage.completedAt && (
                  <div className="text-neutral-500">done {new Date(stage.completedAt).toLocaleString()}</div>
                )}
              </div>
            </div>
            {i < stages.length - 1 && (
              <div
                className={clsx(
                  "mx-1 mb-6 h-0.5 w-10",
                  stage.status === "complete" ? "bg-emerald-500/60" : "bg-neutral-700",
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
