"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api-client";
import type { Signal, SourceRecord } from "@/lib/types";

const SENTIMENT_DOT: Record<Signal["sentiment"], string> = {
  positive: "bg-emerald-500",
  negative: "bg-red-500",
  mixed: "bg-sky-500",
  neutral: "bg-neutral-400",
};

const MAX_QUOTES = 8;
// scripts/ingest-real-data.ts clips feedback text at this length.
const INGEST_TEXT_LIMIT = 600;

interface Quote {
  key: string;
  text: string;
  tag?: string;
}

// Source records only exist for themes that were promoted to requirements, so
// for every other theme fall back to the signal's own sample verbatims.
function quotesFor(sig: Signal, sources: SourceRecord[]): Quote[] {
  const quotes: Quote[] = [];
  const seen = new Set<string>();
  for (const id of sig.sourceIds) {
    const s = sources.find((x) => x.id === id);
    if (!s || !s.excerpt.trim() || seen.has(s.excerpt)) continue;
    seen.add(s.excerpt);
    quotes.push({ key: s.id, text: s.excerpt, tag: [s.datasetType, s.reliability, s.country].filter(Boolean).join(" / ") });
  }
  sig.sampleVerbatims.forEach((text, i) => {
    if (!text.trim() || seen.has(text)) return;
    seen.add(text);
    quotes.push({ key: `${sig.id}-sample-${i}`, text, tag: "verbatim / sample" });
  });
  return quotes.slice(0, MAX_QUOTES);
}

// Every real feedback theme behind this component's requirements, sorted
// by how often customers raised it. Expand one to see the actual source
// excerpts it was derived from — the evidence chain a requirement traces
// back to (US-8.1).
export function SignalBreakdown({
  signals,
  sources,
  evidenceHref,
}: {
  signals: Signal[];
  sources: SourceRecord[];
  evidenceHref?: (theme: string) => string;
}) {
  if (signals.length === 0) {
    return <p className="text-[13px] text-neutral-500">No signals extracted yet.</p>;
  }
  return (
    <div className="divide-y divide-neutral-100">
      {signals.map((sig) => (
        <SignalRow key={sig.id} signal={sig} quotes={quotesFor(sig, sources)} evidenceHref={evidenceHref} />
      ))}
    </div>
  );
}

function SignalRow({
  signal: sig,
  quotes,
  evidenceHref,
}: {
  signal: Signal;
  quotes: Quote[];
  evidenceHref?: (theme: string) => string;
}) {
  const [overview, setOverview] = useState(sig.aiOverview ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  function onToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!e.currentTarget.open || overview || loading) return;
    setLoading(true);
    setError(false);
    api
      .generateSignalOverview(sig.id)
      .then(setOverview)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  return (
    <details className="group py-3 first:pt-0 last:pb-0" onToggle={onToggle}>
      <summary className="flex cursor-pointer list-none items-center gap-3 text-[13px] text-neutral-800 hover:text-neutral-950">
        <span className={`h-2 w-2 shrink-0 rounded-full ${SENTIMENT_DOT[sig.sentiment]}`} />
        <span className="flex-1 font-medium">{sig.theme}</span>
        <span className="font-mono text-[11px] text-neutral-400">
          {sig.frequency}× · {sig.sentiment}
        </span>
        <span className="text-neutral-300 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-2 border-l-2 border-neutral-100 py-1 pl-5">
        {loading && (
          <div className="mb-3 flex items-center gap-2 text-[12px] text-neutral-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-bmw-blue" />
            Summarizing what customers are saying…
          </div>
        )}
        {error && !loading && <p className="mb-3 text-[12px] text-red-600">Couldn&apos;t generate a summary — try reopening this theme.</p>}
        {overview && !loading && (
          <div className={clsx("mb-3 border-l-2 p-2.5 text-[12px] leading-relaxed", overview.live ? "border-bmw-blue bg-[#eef4fc] text-[#1d3d6b]" : "border-neutral-300 bg-neutral-50 text-neutral-600")}>
            <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
              {overview.live ? "AI overview" : "Overview (offline fallback)"}
            </span>
            {overview.content}
          </div>
        )}
        {quotes.length === 0 ? (
          <p className="text-[12px] text-neutral-400">No verbatims attached to this theme.</p>
        ) : (
          <ul className="space-y-2">
            {quotes.map((q) => (
              <li key={q.key} className="text-[12px] leading-relaxed text-neutral-600">
                {q.tag && <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wide text-neutral-400">[{q.tag}]</span>}
                {q.text}
                {q.text.length >= INGEST_TEXT_LIMIT && <span className="text-neutral-400" title="Shortened at import (600 characters)">…</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400">
          <span>
            Showing {quotes.length} of {sig.frequency} verbatim{sig.frequency === 1 ? "" : "s"}
          </span>
          {evidenceHref && sig.frequency > quotes.length && (
            <Link href={evidenceHref(sig.theme)} className="font-medium text-bmw-blue hover:underline">
              View all in Evidence Explorer →
            </Link>
          )}
        </p>
      </div>
    </details>
  );
}
