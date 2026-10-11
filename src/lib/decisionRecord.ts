import type { EvidenceLevel, Requirement } from "@/lib/types";

// A signed PM decision, kept in this browser so the PDF (with the drawn
// signature) can be re-opened later. The audit trail on the server stores the
// text summary; the signature image only lives here.

export interface DecisionRecord {
  requirementId: string;
  title: string;
  description: string;
  category: string;
  evidenceLevel: EvidenceLevel;
  score: number;
  action: "approved" | "postponed" | "rejected";
  priority: "high" | "medium" | "low";
  dueDate: string; // yyyy-mm-dd
  reason: string;
  signedBy: string;
  signedAt: string; // ISO
  signature: string; // PNG data URL
}

const KEY = (id: string) => `pmk:decision:${id}`;

export function saveDecision(record: DecisionRecord) {
  try {
    localStorage.setItem(KEY(record.requirementId), JSON.stringify(record));
  } catch {
    // Storage full or blocked: the decision is still saved on the server.
  }
}

export function loadDecision(requirementId: string): DecisionRecord | null {
  try {
    const raw = localStorage.getItem(KEY(requirementId));
    return raw ? (JSON.parse(raw) as DecisionRecord) : null;
  } catch {
    return null;
  }
}

export function buildRecord(
  requirement: Requirement,
  score: number,
  fields: Pick<DecisionRecord, "action" | "priority" | "dueDate" | "reason" | "signedBy" | "signedAt" | "signature">,
): DecisionRecord {
  return {
    requirementId: requirement.id,
    title: requirement.title,
    description: requirement.description,
    category: requirement.category.replace(/_/g, " "),
    evidenceLevel: requirement.evidenceLevel,
    score,
    ...fields,
  };
}

export function pdfFileName(r: DecisionRecord) {
  const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  return `PM-Kompass_decision_${slug}_${r.signedAt.slice(0, 10)}.pdf`;
}

// ---------- PDF ----------

const BLUE: [number, number, number] = [28, 105, 212];
const INK: [number, number, number] = [10, 10, 10];
const GREY: [number, number, number] = [107, 114, 128];
const LINE: [number, number, number] = [229, 229, 229];

const ACTION_LABEL = { approved: "APPROVED", postponed: "POSTPONED", rejected: "REJECTED" } as const;
const ACTION_COLOR: Record<DecisionRecord["action"], [number, number, number]> = {
  approved: [4, 120, 87],
  postponed: [180, 83, 9],
  rejected: [185, 28, 28],
};
const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" } as const;

// Rasterise the BMW roundel (public/stakeholders sibling: app icon) for the PDF header.
async function logoPng(): Promise<string | null> {
  try {
    const svg = await fetch("/icon.svg").then((r) => r.text());
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, 0, 0, 256, 256);
    return c.toDataURL("image/png");
  } catch {
    return null;
  }
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export async function buildDecisionPdf(r: DecisionRecord): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 18;
  let y = 18;

  // Header
  const logo = await logoPng();
  if (logo) doc.addImage(logo, "PNG", M, y - 2, 12, 12);
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...INK);
  doc.text("PM Kompass", M + 16, y + 3);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GREY);
  doc.text("BMW Group · Requirement decision record", M + 16, y + 8);
  doc.text(`Record ID: ${r.requirementId}`, W - M, y + 3, { align: "right" });
  doc.text(new Date(r.signedAt).toLocaleString("en-GB"), W - M, y + 8, { align: "right" });
  y += 16;
  doc.setFillColor(...BLUE).rect(M, y, W - 2 * M, 0.8, "F");
  y += 12;

  // Title
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...BLUE);
  doc.text("REQUIREMENT", M, y);
  y += 7;
  doc.setFont("helvetica", "normal").setFontSize(17).setTextColor(...INK);
  const titleLines = doc.splitTextToSize(r.title, W - 2 * M - 30);
  doc.text(titleLines, M, y);
  doc.setFontSize(22).text(r.score.toFixed(1), W - M, y, { align: "right" });
  doc.setFontSize(7.5).setTextColor(...GREY).text("WEIGHTED SCORE", W - M, y + 5, { align: "right" });
  y += titleLines.length * 7 + 3;
  doc.setFontSize(9.5).setTextColor(75, 85, 99);
  const desc = doc.splitTextToSize(r.description, W - 2 * M);
  doc.text(desc, M, y);
  y += desc.length * 4.6 + 4;
  doc.setFontSize(8.5).setTextColor(...GREY);
  doc.text(`Category: ${r.category}   ·   Evidence: ${r.evidenceLevel}`, M, y);
  y += 10;

  // Decision grid
  const colW = (W - 2 * M) / 3;
  doc.setDrawColor(...LINE).setLineWidth(0.3);
  doc.rect(M, y, W - 2 * M, 22);
  doc.line(M + colW, y, M + colW, y + 22);
  doc.line(M + 2 * colW, y, M + 2 * colW, y + 22);
  const cell = (i: number, label: string, value: string, color: [number, number, number] = INK) => {
    const x = M + i * colW + 5;
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...GREY).text(label, x, y + 7);
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...color).text(value, x, y + 15);
  };
  cell(0, "DECISION", ACTION_LABEL[r.action], ACTION_COLOR[r.action]);
  cell(1, "PRIORITY", PRIORITY_LABEL[r.priority]);
  cell(2, "REVIEW DUE", fmtDate(r.dueDate));
  y += 30;

  // Reason
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...BLUE).text("REASON FOR ACTION", M, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(...INK);
  const reason = doc.splitTextToSize(r.reason, W - 2 * M);
  doc.text(reason, M, y);
  y += reason.length * 5 + 12;

  // Signature
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...BLUE).text("DIGITAL SIGNATURE", M, y);
  y += 4;
  doc.setDrawColor(...LINE).rect(M, y, 90, 34);
  try {
    doc.addImage(r.signature, "PNG", M + 2, y + 2, 86, 30);
  } catch {
    // ignore a malformed signature image
  }
  doc.setDrawColor(...GREY).line(M + 4, y + 28, M + 86, y + 28);
  doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...INK).text(r.signedBy, M + 98, y + 10);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GREY);
  doc.text("Product Manager · BMW Group", M + 98, y + 16);
  doc.text(`Signed ${new Date(r.signedAt).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, M + 98, y + 22);

  // Footer
  doc.setDrawColor(...LINE).line(M, 280, W - M, 280);
  doc.setFontSize(7.5).setTextColor(...GREY);
  doc.text("Generated by PM Kompass · Recorded in the workflow audit trail · TUM Hackathon prototype", M, 285);

  return doc.output("blob");
}
