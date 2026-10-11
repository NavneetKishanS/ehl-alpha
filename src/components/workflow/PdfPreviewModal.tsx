"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { buildDecisionPdf, pdfFileName, type DecisionRecord } from "@/lib/decisionRecord";

// Shows the signed decision as a PDF inside the page, with a Save button.
export function PdfPreviewModal({ record, onClose }: { record: DecisionRecord; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    buildDecisionPdf(record)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Decision record PDF"
        className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Decision record</p>
            <p className="mt-0.5 truncate text-[15px] font-medium text-neutral-900">{record.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={url ?? undefined}
              download={pdfFileName(record)}
              aria-disabled={!url}
              className={`flex items-center gap-2 bg-bmw-blue px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0653b6] ${url ? "" : "pointer-events-none opacity-40"}`}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" />
              </svg>
              Save PDF
            </a>
            <button onClick={onClose} className="border border-neutral-300 px-4 py-2.5 text-[13px] font-medium text-neutral-800 hover:border-neutral-900">
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 bg-neutral-100">
          {error ? (
            <p className="p-10 text-center text-[14px] text-red-600">Couldn’t generate the PDF.</p>
          ) : url ? (
            <iframe src={`${url}#toolbar=1&view=FitH`} title="Decision record PDF" className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-neutral-500">Generating PDF…</div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
