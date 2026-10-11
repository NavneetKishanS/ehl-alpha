// Word (.docx) export of the specification. Mirrors the sections of
// components/spec/SpecDocumentView.tsx. Runs in the browser; the `docx`
// library is imported dynamically by the export dialog so it only loads when
// someone actually exports.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { visibleRequirements, type SpecDocument, type SpecOptions, type SpecRequirement } from "./types";

const FONT = "Calibri";
const BLUE = "1C69D4";
const GREY = "6B7280";
const DARK = "111827";

const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function run(text: string, o: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {}) {
  return new TextRun({ text, font: FONT, bold: o.bold, italics: o.italics, color: o.color ?? DARK, size: o.size ?? 21 });
}

function para(children: TextRun[] | string, o: { after?: number; before?: number; indent?: number } = {}) {
  return new Paragraph({
    spacing: { after: o.after ?? 100, before: o.before },
    indent: o.indent ? { left: o.indent } : undefined,
    children: typeof children === "string" ? [run(children)] : children,
  });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel], size: number) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 360 : 240, after: 120 },
    keepNext: true,
    children: [new TextRun({ text, font: FONT, bold: true, color: DARK, size })],
  });
}

function label(text: string) {
  return new Paragraph({
    spacing: { before: 120, after: 40 },
    keepNext: true,
    children: [new TextRun({ text: text.toUpperCase(), font: FONT, bold: true, color: GREY, size: 16 })],
  });
}

const thin = { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

function cell(text: string, width: number, o: { bold?: boolean; header?: boolean; mono?: boolean; right?: boolean; color?: string } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    shading: o.header ? { type: ShadingType.CLEAR, fill: "F3F4F6", color: "auto" } : undefined,
    borders: { top: thin, bottom: thin, left: none, right: none },
    children: [
      new Paragraph({
        alignment: o.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text, font: o.mono ? "Consolas" : FONT, bold: o.bold || o.header, color: o.color ?? DARK, size: o.header ? 17 : 19 })],
      }),
    ],
  });
}

function table(widths: number[], head: string[] | null, rows: string[][], opts: { rightCols?: number[]; monoCols?: number[] } = {}) {
  const mk = (cells: string[], header: boolean) =>
    new TableRow({
      tableHeader: header,
      cantSplit: true,
      children: cells.map((c, i) => cell(c, widths[i], { header, right: opts.rightCols?.includes(i), mono: !header && opts.monoCols?.includes(i) })),
    });
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [...(head ? [mk(head, true)] : []), ...rows.map((r) => mk(r, false))],
  });
}

function requirementBlock(r: SpecRequirement, options: SpecOptions): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [
    heading(`${r.id}  ${r.title}`, HeadingLevel.HEADING_3, 23),
    para(
      [
        run(`${r.component}  ·  ${humanize(r.priority)} priority  ·  ${humanize(r.status)}  ·  ${r.evidenceLevel} evidence  ·  `, { color: GREY, size: 19 }),
        run(`Score ${r.score.toFixed(1)}`, { bold: true, size: 19 }),
      ],
      { after: 80 },
    ),
    para(r.statement),
    label("Rationale"),
    para(r.rationale),
    label("Verification (proposed)"),
    para([run("Method: ", { bold: true }), run(`${r.verification.method}.`)], { after: 40 }),
    para([run("Acceptance: ", { bold: true }), run(r.verification.acceptance)], { after: 40 }),
    para([run(`Basis: ${r.verification.basis}`, { color: GREY, size: 17 })]),
  ];

  if (options.includeScoreBreakdown) {
    out.push(label("Score breakdown"));
    out.push(table([2300, 1300, 5760], ["Factor", "Value × weight", "Rationale"], r.factors.map((f) => [f.label, `${f.rawValue} × ${f.weightPct}%`, f.rationale]), { monoCols: [1] }));
  }
  if (options.includeReviews) {
    out.push(label("Stakeholder review"));
    if (!r.reviews.length) out.push(para([run("No stakeholder review recorded yet.", { color: GREY })]));
    for (const rev of r.reviews) {
      out.push(para([run(rev.reviewer, { bold: true }), run(` (${rev.decision}): ${rev.opinion}`)], { after: 60 }));
    }
    if (r.history.length) {
      out.push(label("Decision history"));
      for (const h of r.history) {
        out.push(para([run(`${formatDate(h.when)}  `, { color: GREY, size: 18 }), run(h.event, { bold: true }), run(` (${h.actor}): ${h.note}`)], { after: 60 }));
      }
    }
  }
  if (options.includeEvidence) {
    out.push(label("Evidence"));
    out.push(para(`${r.sourceCount} linked customer verbatims.`, { after: 60 }));
    for (const v of r.sampleVerbatims) out.push(para([run(`“${v}”`, { italics: true, color: GREY })], { indent: 360, after: 60 }));
    if (r.assumptions.length) {
      out.push(para([run("Assumptions", { bold: true })], { after: 20 }));
      r.assumptions.forEach((a) => out.push(para(`•  ${a}`, { indent: 240, after: 20 })));
    }
    if (r.uncertainties.length) {
      out.push(para([run("Uncertainties", { bold: true })], { after: 20, before: 60 }));
      r.uncertainties.forEach((u) => out.push(para(`•  ${u}`, { indent: 240, after: 20 })));
    }
  }
  out.push(para("", { after: 160 }));
  return out;
}

export async function buildSpecDocx(spec: SpecDocument, options: SpecOptions): Promise<Blob> {
  const reqs = visibleRequirements(spec, options);
  const counts = { high: 0, medium: 0, low: 0 };
  reqs.forEach((r) => counts[r.priority]++);

  const children: (Paragraph | Table)[] = [
    para([run("REQUIREMENTS SPECIFICATION · DRAFT", { bold: true, color: BLUE, size: 18 })], { after: 80 }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: spec.meta.title.toUpperCase(), font: FONT, bold: true, color: DARK, size: 40 })] }),
    para([run(`Generated ${formatDate(spec.meta.generatedAt)}  ·  Version ${spec.meta.version}  ·  ${reqs.length} requirements`, { color: GREY, size: 19 })], { after: 200 }),
    table(
      [2340, 2340, 2340, 2340],
      null,
      [
        ["Vehicle", spec.meta.vehicleName, "Current generation", spec.meta.generation],
        ["Markets", spec.meta.markets.join(", "), "Author", spec.meta.author],
        ["Priority mix", `${counts.high} high · ${counts.medium} medium · ${counts.low} low`, "Status", "Draft for review"],
      ],
    ),

    heading("01. Purpose and scope", HeadingLevel.HEADING_1, 28),
    para(spec.scope),

    heading("02. Market context", HeadingLevel.HEADING_1, 28),
    para(spec.marketContext.persona),
    table([2200, 5160, 2000], ["Topic", "Value", "Source"], spec.marketContext.facts.map((f) => [f.label, f.value, f.source])),
    ...(spec.marketContext.salesByMarket.length
      ? [
          label("Planned sales volume by market (units), source: sales_volumes.xlsx"),
          table(
            [3360, 2000, 2000, 2000],
            ["Market", "2024", "2025", "2030 (est.)"],
            spec.marketContext.salesByMarket.map((m) => [m.market, m.v2024.toLocaleString("en-US"), m.v2025.toLocaleString("en-US"), m.v2030.toLocaleString("en-US")]),
            { rightCols: [1, 2, 3] },
          ),
        ]
      : []),

    heading("03. Requirements summary", HeadingLevel.HEADING_1, 28),
    table(
      [1500, 3400, 1700, 1000, 760, 1000],
      ["ID", "Requirement", "Area", "Priority", "Score", "Status"],
      reqs.map((r) => [r.id, r.title, r.component, humanize(r.priority), r.score.toFixed(1), humanize(r.status)]),
      { rightCols: [4], monoCols: [0] },
    ),

    heading("04. Detailed requirements", HeadingLevel.HEADING_1, 28),
    para(
      [
        run(
          "Score is the weighted average (0 to 100) of customer impact, signal frequency, sales relevance, competitive gap, strategic fit, feasibility and evidence strength. Priority is high from 65, medium from 55, otherwise low.",
          { color: GREY },
        ),
      ],
      { after: 200 },
    ),
    ...reqs.flatMap((r) => requirementBlock(r, options)),

    heading("05. Glossary and notes", HeadingLevel.HEADING_1, 28),
    ...spec.glossary.map((g) => para([run(`${g.term}: `, { bold: true }), run(g.definition)], { after: 60 })),
  ];

  if (spec.notes.length) {
    children.push(label("Notes on the data"));
    spec.notes.forEach((n) => children.push(para(`•  ${n}`, { indent: 240, after: 40 })));
  }

  const document = new Document({
    creator: spec.meta.author,
    title: spec.meta.title,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }],
  });
  return Packer.toBlob(document);
}

export function specFileName(spec: SpecDocument, ext: "pdf" | "docx") {
  const slug = spec.meta.vehicleName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug}-requirements-spec.${ext}`;
}
