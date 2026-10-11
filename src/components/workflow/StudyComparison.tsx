import clsx from "clsx";
import type { CustomerStudyScore } from "@/lib/types";

// Customer-study benchmark for one category: horizontal bars per
// model/region, our model highlighted in BMW blue. Horizontal so full model
// names fit without truncation. Bars start at AXIS_MIN (labelled on the card)
// because every score sits in the 7-10 band, where a 0-based axis hides the
// differences that matter.
const AXIS_MIN = 5;
export function StudyComparison({
  category,
  rows,
  ourModel,
}: {
  category: string;
  rows: CustomerStudyScore[];
  ourModel?: string; // e.g. "BMW 1 Series"
}) {
  const sorted = [...rows].sort((a, b) => b.mean - a.mean);
  const ours = rows.filter((r) => ourModel && r.model.includes(ourModel));
  const best = sorted[0];
  const ourBest = ours.length ? Math.max(...ours.map((r) => r.mean)) : null;
  const gap = ourBest !== null && best ? best.mean - ourBest : null;

  return (
    <div className="border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-[14px] font-medium leading-snug text-neutral-900">{category}</h3>
        {gap !== null && (
          <span
            className={clsx(
              "shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
              gap <= 0.05 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
            )}
            title="Our best score vs. the best score in this category"
          >
            {gap <= 0.05 ? "Leading" : `−${gap.toFixed(1)} vs best`}
          </span>
        )}
      </div>
      <ul className="space-y-2.5">
        {sorted.map((r) => {
          const isOurs = Boolean(ourModel && r.model.includes(ourModel));
          return (
            <li key={`${r.model}-${r.region}`}>
              <div className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className={clsx("truncate", isOurs ? "font-medium text-neutral-900" : "text-neutral-600")}>
                  {r.model}
                  <span className="text-neutral-400"> · {r.region}</span>
                  {r.methodology === "distribution_derived" && <span className="ml-1 text-[10px] text-neutral-400">est.</span>}
                </span>
                <span className={clsx("shrink-0 tabular-nums", isOurs ? "font-semibold text-bmw-blue" : "text-neutral-700")}>
                  {r.mean.toFixed(1)}
                </span>
              </div>
              <div className="relative mt-1 h-1.5 bg-neutral-100">
                <div
                  className={clsx("h-full", isOurs ? "bg-bmw-blue" : "bg-neutral-400", r.methodology === "distribution_derived" && "opacity-60")}
                  style={{ width: `${(Math.max(0, Math.min(10, r.mean) - AXIS_MIN) / (10 - AXIS_MIN)) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[10px] text-neutral-400">Mean score, bars scaled {AXIS_MIN}–10</p>
    </div>
  );
}
