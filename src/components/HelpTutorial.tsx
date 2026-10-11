"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { TUTORIAL_SLIDES } from "@/lib/tutorialSlides";

// A screenshot-driven walkthrough, opened from the "?" icon in SiteHeader.
// Real screenshots of the live app, not illustrations — see
// src/lib/tutorialSlides.ts for why that matters.
export function HelpTutorial({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = TUTORIAL_SLIDES[index];
  const isFirst = index === 0;
  const isLast = index === TUTORIAL_SLIDES.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && !isLast) setIndex((i) => i + 1);
      if (e.key === "ArrowLeft" && !isFirst) setIndex((i) => i - 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFirst, isLast, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border border-neutral-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bmw-blue">How this works</p>
            <h2 className="text-lg font-medium tracking-tight text-neutral-900">PM Kompass walkthrough</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center text-xl text-neutral-400 hover:text-neutral-900"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative aspect-[4/3] w-full bg-neutral-100">
            <Image src={slide.image} alt={slide.title} fill sizes="(max-width: 672px) 100vw, 672px" className="object-cover object-top" />
          </div>
          <div className="p-6">
            <h3 className="text-xl font-light tracking-tight text-neutral-900">{slide.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">{slide.body}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 px-6 py-4">
          <button
            onClick={() => setIndex((i) => i - 1)}
            disabled={isFirst}
            className="flex items-center gap-1.5 border border-neutral-300 px-4 py-2 text-[13px] font-medium text-neutral-800 transition-colors hover:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-1.5">
            {TUTORIAL_SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={clsx("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-bmw-blue" : "w-1.5 bg-neutral-300 hover:bg-neutral-400")}
              />
            ))}
          </div>

          {isLast ? (
            <button onClick={onClose} className="bg-bmw-blue px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0653b6]">
              Done
            </button>
          ) : (
            <button
              onClick={() => setIndex((i) => i + 1)}
              className="flex items-center gap-1.5 bg-bmw-blue px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0653b6]"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
