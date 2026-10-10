"use client";

import clsx from "clsx";
import type { VehicleComponent } from "@/lib/types";

// Placeholder 360 viewer: a simple car silhouette with hotspot dots
// positioned by percentage. Role C swaps the <svg> below for a real
// 360/WebGL viewer (e.g. a frame sequence or three.js model) — the
// hotspot positioning contract (xPct/yPct over the viewer's bounding box)
// stays the same either way.
export function CarHotspotViewer({
  components,
  onSelect,
}: {
  components: VehicleComponent[];
  onSelect: (component: VehicleComponent) => void;
}) {
  return (
    <div className="relative mx-auto aspect-[16/9] w-full max-w-4xl select-none">
      <CarSilhouette />
      {components.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          style={{ left: `${c.hotspot.xPct}%`, top: `${c.hotspot.yPct}%` }}
          className="group absolute -translate-x-1/2 -translate-y-1/2"
          title={c.label}
        >
          <span
            className={clsx(
              "block h-4 w-4 rounded-full border-2 border-white/80 shadow-lg transition-transform group-hover:scale-125",
              c.workflowId ? "bg-bmw-blue" : "bg-neutral-400/70",
            )}
          />
          <span
            className={clsx(
              "absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium shadow-xl opacity-0 transition-opacity group-hover:opacity-100",
              "border-white/10 bg-neutral-900 text-neutral-100",
            )}
          >
            {c.label}
            <span className="ml-1.5 text-neutral-500">
              {c.workflowId ? "· open workflow" : "· create workflow"}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function CarSilhouette() {
  return (
    <svg viewBox="0 0 800 450" className="h-full w-full">
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a4454" />
          <stop offset="100%" stopColor="#161b24" />
        </linearGradient>
      </defs>
      <ellipse cx="400" cy="400" rx="340" ry="18" fill="black" opacity="0.35" />
      <path
        d="M90 300 C100 230 150 210 230 200 C260 150 330 120 420 120 C510 120 560 150 600 200 C680 205 720 230 720 280 L720 300 C720 320 700 330 670 330 L630 330 C630 300 605 280 575 280 C545 280 520 300 520 330 L300 330 C300 300 275 280 245 280 C215 280 190 300 190 330 L140 330 C110 330 90 318 90 300 Z"
        fill="url(#bodyGrad)"
        stroke="#4a5568"
        strokeWidth="2"
      />
      <path d="M255 200 C280 165 335 142 420 142 C500 142 545 165 575 200 Z" fill="#0d1117" opacity="0.85" />
      <line x1="410" y1="142" x2="400" y2="200" stroke="#2a3242" strokeWidth="2" />
      <circle cx="245" cy="330" r="42" fill="#0a0e17" stroke="#4a5568" strokeWidth="3" />
      <circle cx="245" cy="330" r="18" fill="#2a3242" />
      <circle cx="575" cy="330" r="42" fill="#0a0e17" stroke="#4a5568" strokeWidth="3" />
      <circle cx="575" cy="330" r="18" fill="#2a3242" />
      <rect x="95" y="255" width="60" height="14" rx="4" fill="#fde68a" opacity="0.8" />
      <rect x="670" y="255" width="40" height="10" rx="3" fill="#f87171" opacity="0.8" />
    </svg>
  );
}
