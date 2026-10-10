"use client";

import type { Signal, SourceRecord } from "@/lib/types";

const SENTIMENT_DOT: Record<Signal["sentiment"], string> = {
  positive: "bg-emerald-500",
  negative: "bg-red-500",
  mixed: "bg-sky-500",
  neutral: "bg-neutral-400",
};

// Every real feedback theme behind this component's requirements, sorted
// by how often customers raised it. Expand one to see the actual source
// excerpts it was derived from — the evidence chain a requirement traces
// back to (US-8.1).
export function SignalBreakdown({ signals, sources }: { signals: Signal[]; sources: SourceRecord[] }) {
  if (signals.length === 0) {
    return <p className="text-[13px] text-neutral-500">No signals extracted yet.</p>;
  }
  return (
    <div className="divide-y divide-neutral-100">
      {signals.map((sig) => (
        <details key={sig.id} className="group py-3 first:pt-0 last:pb-0">
          <summary className="flex cursor-pointer list-none items-center gap-3 text-[13px] text-neutral-800 hover:text-neutral-950">
            <span className={`h-2 w-2 shrink-0 rounded-full ${SENTIMENT_DOT[sig.sentiment]}`} />
            <span className="flex-1 font-medium">{sig.theme}</span>
            <span className="font-mono text-[11px] text-neutral-400">
              {sig.frequency}× · {sig.sentiment}
            </span>
            <span className="text-neutral-300 transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <ul className="mt-2 space-y-2 border-l-2 border-neutral-100 py-1 pl-5">
            {sig.sourceIds
              .map((id) => sources.find((s) => s.id === id))
              .filter((s): s is SourceRecord => Boolean(s))
              .slice(0, 8)
              .map((s) => (
                <li key={s.id} className="text-[12px] leading-relaxed text-neutral-500">
                  <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wide text-neutral-400">
                    [{s.datasetType}/{s.reliability}
                    {s.country ? `/${s.country}` : ""}]
                  </span>
                  {s.excerpt}
                </li>
              ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
