"use client";

import clsx from "clsx";
import type { Stage } from "@/lib/types";

const OWNER_LABEL: Record<Stage["owner"], string> = { ai: "Kompass", pm: "PM", stakeholder: "Stakeholders" };

// Configurator-style stepper: numbered stages on a progress rail. Hovering a
// stage shows its status, owner and timestamps.
export function PipelineStrip({ stages }: { stages: Stage[] }) {
  const done = stages.filter((s) => s.status === "complete" || s.status === "skipped").length;
  const activeIdx = stages.findIndex((s) => s.status === "active");
  // Rail fills up to the furthest stage that has started (stages can complete out of order).
  const furthest = stages.reduce((max, s, i) => (s.status === "complete" || s.status === "active" ? i : max), 0);
  const progress = stages.length > 1 ? (furthest / (stages.length - 1)) * 100 : 0;
  const railInset = `${50 / Math.max(1, stages.length)}%`;
  const active = activeIdx >= 0 ? stages[activeIdx] : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Workflow progress</p>
          <p className="mt-1 text-lg font-light tracking-tight text-neutral-900">
            {done} of {stages.length} stages complete
            {active && (
              <span className="text-neutral-500">
                {" "}· now: <span className="text-neutral-900">{active.label}</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-neutral-500">
          <Legend className="bg-bmw-blue" label="Complete" />
          <Legend className="border-2 border-bmw-blue bg-white" label="In progress" />
          <Legend className="border border-neutral-300 bg-white" label="Pending" />
        </div>
      </div>

      <div className="-mx-2 overflow-x-auto px-2 pb-2">
        <div className="relative min-w-[760px]">
          {/* rail */}
          <div className="absolute top-[17px] h-[2px] bg-neutral-200" style={{ left: railInset, right: railInset }}>
            <div className="h-full bg-bmw-blue transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
          </div>
          <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
            {stages.map((stage, i) => (
              <li key={stage.key} className="group relative flex flex-col items-center text-center">
                <StageDot stage={stage} index={i} />
                <span
                  className={clsx(
                    "mt-3 max-w-[8.5rem] text-[12px] leading-snug",
                    stage.status === "active" ? "font-semibold text-neutral-900" : stage.status === "complete" ? "text-neutral-800" : "text-neutral-500",
                  )}
                >
                  {stage.label}
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-[0.12em] text-neutral-400">{OWNER_LABEL[stage.owner]}</span>

                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap bg-neutral-950 px-3 py-2 text-left text-[11px] text-white shadow-xl group-hover:block">
                  <div className="font-semibold">{stage.label}</div>
                  <div className="capitalize text-neutral-400">
                    {stage.status} · {OWNER_LABEL[stage.owner]}
                  </div>
                  {stage.startedAt && <div className="text-neutral-500">Started {new Date(stage.startedAt).toLocaleDateString()}</div>}
                  {stage.completedAt && <div className="text-neutral-500">Done {new Date(stage.completedAt).toLocaleDateString()}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function StageDot({ stage, index }: { stage: Stage; index: number }) {
  const n = String(index + 1).padStart(2, "0");
  if (stage.status === "complete")
    return (
      <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-bmw-blue text-white shadow-[0_4px_12px_rgba(28,105,212,0.35)]">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
    );
  if (stage.status === "active")
    return (
      <span className="relative z-10 flex h-9 w-9 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-bmw-blue/25 [animation-duration:2s]" />
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-bmw-blue bg-white text-[11px] font-semibold text-bmw-blue">
          {n}
        </span>
      </span>
    );
  if (stage.status === "blocked")
    return (
      <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-red-500 bg-white text-[11px] font-semibold text-red-600">
        !
      </span>
    );
  return (
    <span
      className={clsx(
        "relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[11px] font-medium text-neutral-400",
        stage.status === "skipped" ? "border border-dashed border-neutral-300" : "border border-neutral-300",
      )}
    >
      {n}
    </span>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx("h-3 w-3 rounded-full", className)} />
      {label}
    </span>
  );
}
