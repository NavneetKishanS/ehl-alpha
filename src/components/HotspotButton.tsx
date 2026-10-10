"use client";

import clsx from "clsx";
import type { VehicleComponent } from "@/lib/types";

// The clickable "+" marker shared by both car viewers. Positioning is the
// caller's job; this renders centred on its own origin.
export function HotspotButton({
  component,
  highlighted,
  onSelect,
  onHover,
}: {
  component: VehicleComponent;
  highlighted: boolean;
  onSelect: (c: VehicleComponent) => void;
  onHover: (id: string | null) => void;
}) {
  const active = Boolean(component.workflowId);
  return (
    <button
      type="button"
      onClick={() => onSelect(component)}
      onMouseEnter={() => onHover(component.id)}
      onMouseLeave={() => onHover(null)}
      className="group relative flex h-9 w-9 items-center justify-center outline-none"
      aria-label={`${component.label}: ${active ? "open workflow" : "create workflow"}`}
    >
      {active && <span className="absolute inset-0 animate-ping rounded-full bg-bmw-blue/40 [animation-duration:2.2s]" />}
      <span
        className={clsx(
          "relative flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:scale-110",
          highlighted && "scale-125",
          active ? "border-white bg-bmw-blue" : "border-white bg-white/85 backdrop-blur",
        )}
      >
        <span className={clsx("text-base font-light leading-none", active ? "text-white" : "text-neutral-700")}>+</span>
      </span>
      <span
        className={clsx(
          "pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap bg-neutral-950/90 px-3 py-1.5 text-left text-xs text-white shadow-xl backdrop-blur transition-opacity duration-150",
          highlighted ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <span className="block font-semibold">{component.label}</span>
        <span className="block text-[11px] text-neutral-400">{active ? "Workflow in progress · open" : "No workflow · create"}</span>
      </span>
    </button>
  );
}
