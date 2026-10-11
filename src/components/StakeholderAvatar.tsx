"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Stakeholder } from "@/lib/types";

// Stock portraits (Unsplash License, free to use) stored in public/stakeholders
// so they work offline. Swap a photo by replacing the file; a stakeholder with
// no entry, or an image that fails to load, falls back to the coloured initial.
const PHOTO: Record<string, string> = {
  sh_rnd: "/stakeholders/sh_rnd.jpg",
  sh_manufacturing: "/stakeholders/sh_manufacturing.jpg",
  sh_controlling: "/stakeholders/sh_controlling.jpg",
  sh_procurement: "/stakeholders/sh_procurement.jpg",
};

export function StakeholderAvatar({
  stakeholder,
  size = 32,
  className,
}: {
  stakeholder?: Stakeholder | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const color = stakeholder?.avatarColor ?? "#9ca3af";
  const photo = stakeholder ? PHOTO[stakeholder.id] : undefined;
  const initial = (stakeholder?.name ?? "?").slice(0, 1);
  // Ring in the stakeholder's colour keeps them recognisable across views.
  const ring = Math.max(2, Math.round(size / 16));

  return (
    <span
      className={clsx("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white", className)}
      style={{ width: size, height: size, backgroundColor: color, boxShadow: `0 0 0 ${ring}px ${color}`, fontSize: Math.round(size * 0.4) }}
      title={stakeholder?.name}
    >
      {photo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny local avatars; next/image adds nothing here
        <img src={photo} alt={stakeholder?.name ?? ""} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="font-semibold">{initial}</span>
      )}
    </span>
  );
}
