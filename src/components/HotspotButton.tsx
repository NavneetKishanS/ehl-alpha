"use client";

import clsx from "clsx";
import type { ComponentSentiment, VehicleComponent } from "@/lib/types";

type Mood = "liked" | "disliked" | "mixed" | "unknown";

// Green when customers like this component more than they complain about it,
// red when complaints win, amber on a tie.
export function moodOf(s?: ComponentSentiment): Mood {
  if (!s || s.likes + s.complaints === 0) return "unknown";
  if (s.likes > s.complaints) return "liked";
  if (s.complaints > s.likes) return "disliked";
  return "mixed";
}

export const MOOD_STYLE: Record<Mood, { dot: string; ping: string; label: string }> = {
  liked: { dot: "bg-emerald-600", ping: "bg-emerald-500/40", label: "Mostly liked" },
  disliked: { dot: "bg-red-600", ping: "bg-red-500/40", label: "Mostly complaints" },
  mixed: { dot: "bg-amber-500", ping: "bg-amber-400/40", label: "Mixed feedback" },
  unknown: { dot: "bg-bmw-blue", ping: "bg-bmw-blue/40", label: "No feedback yet" },
};

// The clickable "+" marker shared by both car viewers. Positioning is the
// caller's job; this renders centred on its own origin.
export function HotspotButton({
  component,
  sentiment,
  highlighted,
  onSelect,
  onHover,
}: {
  component: VehicleComponent;
  sentiment?: ComponentSentiment;
  highlighted: boolean;
  onSelect: (c: VehicleComponent) => void;
  onHover: (id: string | null) => void;
}) {
  const active = Boolean(component.workflowId);
  const mood = moodOf(sentiment);
  const style = MOOD_STYLE[mood];
  const total = sentiment ? sentiment.likes + sentiment.complaints : 0;
  const likePct = total ? Math.round((sentiment!.likes / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(component)}
      onMouseEnter={() => onHover(component.id)}
      onMouseLeave={() => onHover(null)}
      className="group relative flex h-9 w-9 items-center justify-center outline-none"
      aria-label={`${component.label}: ${style.label}, ${active ? "open workflow" : "create workflow"}`}
    >
      {active && <span className={clsx("absolute inset-0 animate-ping rounded-full [animation-duration:2.2s]", style.ping)} />}
      <span
        className={clsx(
          "relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:scale-110",
          highlighted && "scale-125",
          style.dot,
        )}
      >
        <span className="text-base font-light leading-none text-white">+</span>
      </span>
      <span
        className={clsx(
          "pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap bg-neutral-950/90 px-3 py-2 text-left text-xs text-white shadow-xl backdrop-blur transition-opacity duration-150",
          highlighted ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <span className="block font-semibold">{component.label}</span>
        {total > 0 && (
          <>
            <span className="mt-1.5 flex h-1.5 w-40 overflow-hidden bg-red-500">
              <span className="block h-full bg-emerald-500" style={{ width: `${likePct}%` }} />
            </span>
            <span className="mt-1 block text-[11px] text-neutral-300">
              {sentiment!.likes.toLocaleString()} likes · {sentiment!.complaints.toLocaleString()} complaints
            </span>
          </>
        )}
        <span className="mt-0.5 block text-[11px] text-neutral-400">{active ? "Workflow in progress · open" : "No workflow · create"}</span>
      </span>
    </button>
  );
}
