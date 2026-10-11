"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { DEFAULT_SPEC_OPTIONS, type SpecDocument, type SpecOptions } from "@/lib/spec/types";
import { SpecDocumentView } from "./SpecDocumentView";

type Format = "pdf" | "docx";

const OPTION_LABELS: { key: keyof SpecOptions; label: string; hint: string }[] = [
  { key: "includeNonApproved", label: "Include non-approved requirements", hint: "Proposed, challenged and postponed items, marked with their status." },
  { key: "includeScoreBreakdown", label: "Score breakdown", hint: "Factor values, weights and rationale per requirement." },
  { key: "includeReviews", label: "Reviews and decision history", hint: "Recorded stakeholder reviews and the PM / AI decision trail." },
  { key: "includeEvidence", label: "Evidence and assumptions", hint: "Linked verbatims, assumptions and uncertainties." },
];

// Export dialog: pick PDF or Word, choose what to include, check the live
// preview, then export. PDF opens the browser print dialog (print CSS in
// globals.css shows only this preview); Word is generated in the browser.
export function SpecExportModal({ spec, onClose }: { spec: SpecDocument; onClose: () => void }) {
  const [format, setFormat] = useState<Format>("pdf");
  const [options, setOptions] = useState<SpecOptions>(DEFAULT_SPEC_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function doExport() {
    setError(null);
    if (format === "pdf") {
      const root = document.documentElement;
      const done = () => {
        root.classList.remove("printing-spec");
        window.removeEventListener("afterprint", done);
      };
      root.classList.add("printing-spec");
      window.addEventListener("afterprint", done);
      window.print();
      return;
    }
    setBusy(true);
    try {
      const { buildSpecDocx, specFileName } = await import("@/lib/spec/docx");
      const blob = await buildSpecDocx(spec, options);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = specFileName(spec, "docx");
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      setError("Couldn't generate the Word document.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      id="spec-print-root"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:static print:block print:bg-white print:p-0"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export specification"
        className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl print:block print:h-auto print:max-w-none print:overflow-visible print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4 print:hidden">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Export specification</p>
            <p className="mt-1 text-[13px] text-neutral-600">Choose a format, preview the document and pick what to include before exporting.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="px-2 text-xl leading-none text-neutral-500 hover:text-neutral-900">
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1 print:block">
          <aside className="w-72 shrink-0 space-y-6 overflow-y-auto border-r border-neutral-200 p-6 print:hidden">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">Format</p>
              <div role="radiogroup" aria-label="Format" className="mt-2 grid grid-cols-2 border border-neutral-300">
                {(["pdf", "docx"] as const).map((f) => (
                  <button
                    key={f}
                    role="radio"
                    aria-checked={format === f}
                    onClick={() => setFormat(f)}
                    className={clsx("px-3 py-2 text-[13px] font-medium transition-colors", format === f ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-50")}
                  >
                    {f === "pdf" ? "PDF" : "Word"}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] leading-snug text-neutral-500">
                {format === "pdf" ? "PDF opens your browser print dialog; choose “Save as PDF”." : "Word downloads an editable .docx file."}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">Include</p>
              <div className="mt-2 space-y-3">
                {OPTION_LABELS.map((o) => (
                  <label key={o.key} className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={options[o.key]}
                      onChange={(e) => setOptions({ ...options, [o.key]: e.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-[#1c69d4]"
                    />
                    <span>
                      <span className="block text-[13px] font-medium text-neutral-900">{o.label}</span>
                      <span className="block text-[11.5px] leading-snug text-neutral-500">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <p className="border border-neutral-200 bg-neutral-50 p-3 text-[11.5px] leading-snug text-neutral-600">
              Built from recorded workflow data. Verification targets are proposals derived from the customer study and feedback.
            </p>
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto bg-neutral-100 p-6 print:overflow-visible print:bg-white print:p-0">
            <SpecDocumentView doc={spec} options={options} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4 print:hidden">
          {error && <span className="mr-auto text-[13px] text-red-600">{error}</span>}
          <button onClick={onClose} className="border border-neutral-300 px-5 py-2.5 text-[13px] font-medium text-neutral-800 hover:border-neutral-900">
            Cancel
          </button>
          <button
            onClick={doExport}
            disabled={busy}
            className="bg-bmw-blue px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0653b6] disabled:opacity-50"
          >
            {busy ? "Generating…" : format === "pdf" ? "Export to PDF" : "Export to Word"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
