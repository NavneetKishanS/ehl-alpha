"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { StakeholderAvatar } from "@/components/StakeholderAvatar";
import type { Stakeholder } from "@/lib/types";

type Role = { type: "pm" } | { type: "stakeholder"; stakeholderId: string };

// Lets a demo presenter jump between "how the PM sees this" and "how each
// stakeholder sees this" without hand-typing URLs. Self-contained (owns its
// own open/close + click-outside), so it drops into either the light
// workflow page or the dark stakeholder page without needing those pages'
// theme machinery.
export function RoleSwitcher({
  componentId,
  workflowId,
  stakeholders,
  current,
  variant = "light",
}: {
  componentId: string;
  workflowId: string;
  stakeholders: Stakeholder[];
  current: Role;
  variant?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const currentLabel =
    current.type === "pm" ? "PM workflow view" : `Stakeholder — ${stakeholders.find((s) => s.id === current.stakeholderId)?.name.split(" — ")[0] ?? "…"}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex items-center gap-2 border px-3 py-2 text-xs font-medium transition-colors",
          variant === "light"
            ? "border-neutral-300 bg-white/90 text-neutral-800 backdrop-blur hover:border-neutral-900"
            : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500",
        )}
      >
        <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", current.type === "pm" ? "bg-bmw-blue" : "bg-amber-500")} />
        <span className="max-w-[180px] truncate">{currentLabel}</span>
        <span className={clsx("text-[10px] transition-transform", open && "rotate-180")}>⌄</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 border border-neutral-200 bg-white text-left shadow-xl">
          <Link
            href={`/workflow/${componentId}`}
            onClick={() => setOpen(false)}
            className={clsx(
              "flex items-center gap-2 px-3 py-2.5 text-[13px] text-neutral-800 hover:bg-neutral-50",
              current.type === "pm" && "bg-neutral-50 font-medium",
            )}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-bmw-blue" />
            PM workflow view
          </Link>
          <div className="border-t border-neutral-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            View as stakeholder
          </div>
          {stakeholders.map((s) => (
            <Link
              key={s.id}
              href={`/stakeholder/${workflowId}/${s.id}`}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-neutral-50",
                current.type === "stakeholder" && current.stakeholderId === s.id && "bg-neutral-50 font-medium",
              )}
            >
              <StakeholderAvatar stakeholder={s} size={24} />
              <span className="min-w-0 flex-1 truncate text-neutral-800">{s.name}</span>
              <span className="shrink-0 text-[10px] uppercase text-neutral-400">{s.expertise.split("_")[0]}</span>
            </Link>
          ))}
          {stakeholders.length === 0 && <p className="px-3 py-2.5 text-[12px] text-neutral-400">No stakeholders on this workflow.</p>}
        </div>
      )}
    </div>
  );
}
