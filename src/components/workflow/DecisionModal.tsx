"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import type { Requirement } from "@/lib/types";
import { EvidenceMeter } from "@/components/workflow/primitives";

export type DecisionAction = "approved" | "postponed" | "rejected";
export type Priority = "high" | "medium" | "low";

export interface DecisionDraft {
  action: DecisionAction;
  dueDate: string; // yyyy-mm-dd
  priority: Priority;
  reason: string;
}

const ACTION: Record<DecisionAction, { label: string; verb: string; chip: string; button: string }> = {
  approved: { label: "Approve", verb: "Approved", chip: "bg-emerald-50 text-emerald-700", button: "bg-bmw-blue hover:bg-[#0653b6] text-white" },
  postponed: { label: "Postpone", verb: "Postponed", chip: "bg-amber-50 text-amber-800", button: "bg-neutral-900 hover:bg-black text-white" },
  rejected: { label: "Reject", verb: "Rejected", chip: "bg-red-50 text-red-700", button: "bg-red-600 hover:bg-red-700 text-white" },
};

export const PRIORITY: Record<Priority, { label: string; dot: string }> = {
  high: { label: "High", dot: "bg-red-500" },
  medium: { label: "Medium", dot: "bg-amber-500" },
  low: { label: "Low", dot: "bg-emerald-500" },
};

export function formatDue(date: string) {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

// Preview of a PM decision with a drawn signature. Nothing is saved until the
// PM signs and confirms; `onConfirm` receives the signer, timestamp and signature image.
export function DecisionModal({
  requirement,
  score,
  draft,
  busy,
  onCancel,
  onConfirm,
}: {
  requirement: Requirement;
  score: number;
  draft: DecisionDraft;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (signedBy: string, signedAt: Date, signature: string) => void;
}) {
  const [signer, setSigner] = useState("Product Manager");
  const [hasInk, setHasInk] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [now] = useState(() => new Date());
  const signatureRef = useRef<HTMLCanvasElement>(null);
  const a = ACTION[draft.action];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onCancel]);

  const canSign = hasInk && confirmed && signer.trim().length > 0 && !busy;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => !busy && onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-7 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Decision preview</p>
            <h2 id="decision-title" className="mt-1 text-2xl font-light tracking-tight text-neutral-900">
              Review &amp; sign
            </h2>
          </div>
          <button onClick={onCancel} disabled={busy} className="text-xl leading-none text-neutral-400 hover:text-neutral-900" aria-label="Close">
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-7 py-6">
          {/* Requirement */}
          <div className="flex items-start justify-between gap-4 border border-neutral-200 bg-neutral-50 p-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">Requirement</p>
              <p className="mt-1 text-[16px] font-medium leading-snug text-neutral-900">{requirement.title}</p>
              <div className="mt-2">
                <EvidenceMeter level={requirement.evidenceLevel} />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">Score</p>
              <p className="text-2xl font-light tabular-nums text-neutral-900">{score.toFixed(1)}</p>
            </div>
          </div>

          {/* Fields */}
          <dl className="mt-5 grid grid-cols-1 gap-px bg-neutral-200 sm:grid-cols-3">
            <Field label="Decision">
              <span className={clsx("px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", a.chip)}>{a.verb}</span>
            </Field>
            <Field label="Priority">
              <span className="flex items-center gap-2 text-[15px] text-neutral-900">
                <span className={clsx("h-2.5 w-2.5 rounded-full", PRIORITY[draft.priority].dot)} />
                {PRIORITY[draft.priority].label}
              </span>
            </Field>
            <Field label="Review due">
              <span className="text-[15px] text-neutral-900">{formatDue(draft.dueDate)}</span>
            </Field>
          </dl>
          <div className="mt-px bg-neutral-200">
            <div className="bg-white px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">Reason for action</p>
              <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-neutral-800">{draft.reason}</p>
            </div>
          </div>

          {/* Signature */}
          <div className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Digital signature</p>
              <p className="text-[12px] text-neutral-500">
                {now.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <SignaturePad canvasRef={signatureRef} onInkChange={setHasInk} />
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <label className="block">
                <span className="sr-only">Signer name</span>
                <input
                  value={signer}
                  onChange={(e) => setSigner(e.target.value)}
                  placeholder="Full name"
                  className="w-full border border-neutral-300 px-3 py-2.5 text-[14px] text-neutral-900 outline-none focus:border-neutral-900"
                />
              </label>
              <span className="text-[12px] text-neutral-500">Product Manager · BMW Group</span>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-neutral-700">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-bmw-blue" />
              I confirm this decision and that it will be recorded in the audit trail under my name.
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-7 py-4">
          <p className="text-[12px] text-neutral-500">{canSign ? "Ready to sign." : "Sign above and tick the confirmation to continue."}</p>
          <div className="flex gap-2">
            <button onClick={onCancel} disabled={busy} className="border border-neutral-300 bg-white px-5 py-2.5 text-[13px] font-medium text-neutral-800 hover:border-neutral-900 disabled:opacity-50">
              Back to edit
            </button>
            <button
              onClick={() => onConfirm(signer.trim(), now, signatureRef.current?.toDataURL("image/png") ?? "")}
              disabled={!canSign}
              className={clsx("px-5 py-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40", a.button)}
            >
              {busy ? "Saving…" : `Sign & ${a.label.toLowerCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

function SignaturePad({ canvasRef, onInkChange }: { canvasRef: React.RefObject<HTMLCanvasElement>; onInkChange: (hasInk: boolean) => void }) {
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#0a1e3c";
  }, [canvasRef]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) {
      setEmpty(false);
      onInkChange(true);
    }
  }
  function end() {
    drawing.current = false;
    last.current = null;
  }
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onInkChange(false);
  }

  return (
    <div className="relative mt-3 border border-dashed border-neutral-300 bg-[linear-gradient(to_bottom,transparent_calc(100%-36px),#e5e7eb_calc(100%-36px),#e5e7eb_calc(100%-35px),transparent_calc(100%-35px))]">
      <canvas
        ref={canvasRef}
        className="block h-36 w-full cursor-crosshair touch-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        aria-label="Signature pad: draw your signature"
      />
      {empty && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-neutral-400">
          Draw your signature here
        </span>
      )}
      <span className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-neutral-400">✕</span>
      {!empty && (
        <button onClick={clear} className="absolute right-2 top-2 text-[12px] font-medium text-neutral-500 hover:text-neutral-900">
          Clear
        </button>
      )}
    </div>
  );
}
