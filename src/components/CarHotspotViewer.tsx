"use client";

import clsx from "clsx";
import type { VehicleComponent } from "@/lib/types";

// Blueprint-style side-profile illustration with hotspot dots positioned
// by percentage over the viewer's bounding box. Deliberately a technical
// line drawing, not a photo or glossy render — no licensing question, and
// it reads as "engineering tool" rather than "marketing page", which fits
// the rest of the app. Role C: swap for a real 360/WebGL viewer later if
// time allows; the hotspot positioning contract (xPct/yPct) stays the same
// either way.
export function CarHotspotViewer({
  components,
  vehicleCode,
  onSelect,
}: {
  components: VehicleComponent[];
  vehicleCode?: string;
  onSelect: (component: VehicleComponent) => void;
}) {
  return (
    <div className="relative mx-auto aspect-[16/9] w-full max-w-4xl select-none border border-neutral-800 bg-neutral-950">
      <CarBlueprint code={vehicleCode} />
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
              c.workflowId ? "bg-bmw-blue" : "bg-neutral-500/70",
            )}
          />
          <span
            className={clsx(
              "absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap border px-2.5 py-1 text-xs font-medium shadow-xl opacity-0 transition-opacity group-hover:opacity-100",
              "border-neutral-700 bg-neutral-900 text-neutral-100",
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

// ---------------------------------------------------------------------------
// Per-vehicle silhouettes. Proportions are illustrative (relative length/
// wheelbase/greenhouse only), not to-scale technical drawings of the real
// cars — the point is "this reads as compact / mid-size / flagship", not
// dimensional accuracy.
// ---------------------------------------------------------------------------

interface Profile {
  code: string;
  name: string;
  /** SVG path for the body, in the shared 900x420 viewBox. */
  body: string;
  /** SVG path for the greenhouse/window line. */
  greenhouse: string;
  frontWheelX: number;
  rearWheelX: number;
  wheelY: number;
  wheelR: number;
  doorLines: number[]; // x positions of door seams
  lengthLabel: string;
}

const PROFILES: Record<string, Profile> = {
  F70: {
    code: "F70",
    name: "1 SERIES",
    body: "M200 300 C208 255 235 235 290 228 C312 190 360 168 430 168 C495 168 538 190 558 228 C610 232 648 252 656 282 L656 300 C656 316 642 324 618 324 L585 324 C585 298 563 280 536 280 C509 280 487 298 487 324 L370 324 C370 298 348 280 321 280 C294 280 272 298 272 324 L232 324 C212 324 200 314 200 300 Z",
    greenhouse: "M300 228 C318 198 362 180 430 180 C494 180 532 198 548 228 Z",
    frontWheelX: 321,
    rearWheelX: 536,
    wheelY: 324,
    wheelR: 38,
    doorLines: [430],
    lengthLabel: "~4.36M",
  },
  G60: {
    code: "G60",
    name: "5 SERIES",
    body: "M140 310 C150 248 198 224 270 214 C298 162 358 132 440 132 C522 132 568 162 598 214 C668 218 706 242 706 288 L706 310 C706 328 688 336 660 336 L622 336 C622 306 598 284 568 284 C538 284 514 306 514 336 L326 336 C326 306 302 284 272 284 C242 284 218 306 218 336 L172 336 C150 336 140 324 140 310 Z",
    greenhouse: "M282 214 C305 178 358 152 440 152 C518 152 562 178 584 214 Z",
    frontWheelX: 272,
    rearWheelX: 568,
    wheelY: 336,
    wheelR: 42,
    doorLines: [420, 492],
    lengthLabel: "~5.06M",
  },
  G70: {
    code: "G70",
    name: "7 SERIES",
    body: "M90 318 C100 250 155 222 236 212 C268 154 338 120 440 120 C544 120 602 154 640 212 C716 216 756 240 766 290 L766 318 C766 336 746 344 714 344 L670 344 C670 312 644 288 610 288 C576 288 550 312 550 344 L336 344 C336 312 310 288 276 288 C242 288 216 312 216 344 L164 344 C138 344 90 334 90 318 Z",
    greenhouse: "M248 212 C274 170 340 140 440 140 C534 140 586 170 614 212 Z",
    frontWheelX: 276,
    rearWheelX: 610,
    wheelY: 344,
    wheelR: 44,
    doorLines: [400, 486, 560],
    lengthLabel: "~5.39M",
  },
};

function CarBlueprint({ code }: { code?: string }) {
  const profile = PROFILES[code ?? ""] ?? PROFILES.G60;
  const gridId = `grid-${profile.code}`;

  return (
    <svg viewBox="0 0 900 420" className="h-full w-full">
      <defs>
        <pattern id={gridId} width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M30 0 L0 0 0 30" fill="none" stroke="#1c2433" strokeWidth="1" />
        </pattern>
      </defs>

      <rect width="900" height="420" fill={`url(#${gridId})`} />
      {/* corner tick marks, engineering-drawing convention */}
      {[
        [20, 20],
        [880, 20],
        [20, 400],
        [880, 400],
      ].map(([x, y], i) => (
        <g key={i} stroke="#324055" strokeWidth="1.5">
          <line x1={x - 10} y1={y} x2={x + 10} y2={y} />
          <line x1={x} y1={y - 10} x2={x} y2={y + 10} />
        </g>
      ))}

      <text x="24" y="44" fontSize="13" fill="#4a5568" fontFamily="monospace" letterSpacing="2">
        {profile.name}
      </text>
      <text x="24" y="60" fontSize="10" fill="#374151" fontFamily="monospace">
        CHASSIS {profile.code}
      </text>

      <ellipse cx={(profile.frontWheelX + profile.rearWheelX) / 2} cy={profile.wheelY + 10} rx={(profile.rearWheelX - profile.frontWheelX) / 2 + 90} ry="12" fill="black" opacity="0.4" />

      <path d={profile.body} fill="#151b26" stroke="#5b7fb5" strokeWidth="2" />
      <path d={profile.greenhouse} fill="#0a0e17" stroke="#3a4a63" strokeWidth="1.5" />

      {profile.doorLines.map((x) => (
        <line key={x} x1={x} y1={profile.wheelY - 40} x2={x} y2={profile.wheelY} stroke="#2a3548" strokeWidth="1" />
      ))}

      {[profile.frontWheelX, profile.rearWheelX].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={profile.wheelY} r={profile.wheelR} fill="#0a0e17" stroke="#5b7fb5" strokeWidth="2" />
          <circle cx={cx} cy={profile.wheelY} r={profile.wheelR * 0.42} fill="#1c2433" stroke="#324055" strokeWidth="1" />
        </g>
      ))}

      {/* wheelbase dimension line */}
      <g stroke="#324055" strokeWidth="1" fontFamily="monospace">
        <line x1={profile.frontWheelX} y1={382} x2={profile.rearWheelX} y2={382} />
        <line x1={profile.frontWheelX} y1={376} x2={profile.frontWheelX} y2={388} />
        <line x1={profile.rearWheelX} y1={376} x2={profile.rearWheelX} y2={388} />
        <text x={(profile.frontWheelX + profile.rearWheelX) / 2} y={398} fontSize="10" fill="#4a5568" textAnchor="middle">
          {profile.lengthLabel} OAL
        </text>
      </g>
    </svg>
  );
}
