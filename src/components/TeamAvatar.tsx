"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

// Team photos live in public/team/<slug>.jpg. Drop a file in with the
// matching slug to replace the initials fallback below — no code change
// needed.
export function TeamAvatar({
  slug,
  name,
  color,
  size = 96,
  className,
}: {
  slug: string;
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // The browser can start (and finish failing) the image request from the
  // server-rendered HTML before React hydrates and attaches onError, so that
  // event never reaches us. Catch the already-failed case on mount too.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      className={clsx("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white", className)}
      style={{ width: size, height: size, backgroundColor: color, fontSize: Math.round(size * 0.32) }}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- small local/offline-capable avatar, next/image adds nothing here
        <img
          ref={imgRef}
          src={`/team/${slug}.jpg`}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-semibold">{initials}</span>
      )}
    </span>
  );
}
