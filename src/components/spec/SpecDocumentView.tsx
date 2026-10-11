import clsx from "clsx";
import { BmwLogo } from "@/components/BmwLogo";
import { visibleRequirements, type SpecDocument, type SpecOptions, type SpecRequirement } from "@/lib/spec/types";

// The specification as a printable "paper": used for the live preview in the
// export dialog and, via the browser print dialog, for the PDF export.
// Keep content in step with lib/spec/docx.ts (the Word export).

const PRIORITY_STYLE = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-neutral-100 text-neutral-600",
} as const;

export function humanize(s: string) {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function SpecDocumentView({ doc, options }: { doc: SpecDocument; options: SpecOptions }) {
  const reqs = visibleRequirements(doc, options);
  const counts = { high: 0, medium: 0, low: 0 };
  reqs.forEach((r) => counts[r.priority]++);

  return (
    <article className="spec-paper mx-auto w-full max-w-[820px] bg-white px-10 py-12 text-[13px] leading-relaxed text-neutral-800 sm:px-14">
      <header>
        <div className="flex items-center gap-3">
          <BmwLogo size={44} />
          <span className="h-7 w-px bg-neutral-300" />
          <span className="text-[15px] font-semibold tracking-tight text-neutral-900">PM Kompass</span>
        </div>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.25em] text-bmw-blue">Requirements specification · Draft</p>
        <h1 className="mt-3 text-3xl font-semibold uppercase leading-tight tracking-tight text-neutral-900">{doc.meta.title}</h1>
        <p className="mt-3 text-[12px] text-neutral-500">
          Generated {formatDate(doc.meta.generatedAt)} · Version {doc.meta.version} · {reqs.length} requirements
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Meta label="Vehicle" value={doc.meta.vehicleName} />
          <Meta label="Current generation" value={doc.meta.generation} />
          <Meta label="Markets" value={doc.meta.markets.join(", ")} />
          <Meta label="Author" value={doc.meta.author} />
          <Meta label="Priority mix" value={`${counts.high} high · ${counts.medium} medium · ${counts.low} low`} />
          <Meta label="Status" value="Draft for review" />
        </dl>
      </header>

      <Section n="01" title="Purpose and scope">
        <p>{doc.scope}</p>
      </Section>

      <Section n="02" title="Market context">
        <p>{doc.marketContext.persona}</p>
        <table className="mt-4 w-full border-collapse text-[12px]">
          <tbody>
            {doc.marketContext.facts.map((f) => (
              <tr key={f.label} className="border-t border-neutral-200 align-top">
                <td className="w-1/4 py-2 pr-3 font-medium text-neutral-900">{f.label}</td>
                <td className="py-2 pr-3">{f.value}</td>
                <td className="w-1/5 py-2 text-[11px] text-neutral-500">{f.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {doc.marketContext.salesByMarket.length > 0 && (
          <>
            <Label>Planned sales volume by market (units)</Label>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-neutral-900 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
                  <th className="py-1.5">Market</th>
                  <th className="py-1.5 text-right">2024</th>
                  <th className="py-1.5 text-right">2025</th>
                  <th className="py-1.5 text-right">2030 (est.)</th>
                </tr>
              </thead>
              <tbody>
                {doc.marketContext.salesByMarket.map((m) => (
                  <tr key={m.market} className="border-b border-neutral-200">
                    <td className="py-1.5">{m.market}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{m.v2024.toLocaleString("en-US")}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{m.v2025.toLocaleString("en-US")}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{m.v2030.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-neutral-500">Source: sales_volumes.xlsx</p>
          </>
        )}
      </Section>

      <Section n="03" title="Requirements summary">
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-b-2 border-neutral-900 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
              <th className="py-2 pr-2">ID</th>
              <th className="py-2 pr-2">Requirement</th>
              <th className="py-2 pr-2">Area</th>
              <th className="py-2 pr-2">Priority</th>
              <th className="py-2 pr-2 text-right">Score</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {reqs.map((r) => (
              <tr key={r.id} className="border-b border-neutral-200 align-top">
                <td className="whitespace-nowrap py-1.5 pr-2 font-mono text-[10.5px] text-neutral-500">{r.id}</td>
                <td className="py-1.5 pr-2 text-neutral-900">{r.title}</td>
                <td className="py-1.5 pr-2">{r.component}</td>
                <td className="py-1.5 pr-2">{humanize(r.priority)}</td>
                <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{r.score.toFixed(1)}</td>
                <td className="py-1.5">{humanize(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section n="04" title="Detailed requirements">
        <p className="text-neutral-600">
          Score is the weighted average (0 to 100) of customer impact, signal frequency, sales relevance, competitive gap, strategic fit,
          feasibility and evidence strength. Priority is high from 65, medium from 55, otherwise low.
        </p>
        <div className="mt-6 space-y-8">
          {reqs.map((r) => (
            <RequirementBlock key={r.id} r={r} options={options} />
          ))}
        </div>
      </Section>

      <Section n="05" title="Glossary and notes">
        <dl className="space-y-1.5">
          {doc.glossary.map((g) => (
            <div key={g.term}>
              <dt className="inline font-semibold text-neutral-900">{g.term}: </dt>
              <dd className="inline">{g.definition}</dd>
            </div>
          ))}
        </dl>
        {doc.notes.length > 0 && (
          <div className="mt-5 border border-neutral-200 bg-neutral-50 p-3 text-[12px] text-neutral-700">
            <p className="font-semibold text-neutral-900">Notes on the data</p>
            <ul className="mt-1 list-disc pl-5">
              {doc.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-neutral-300 pt-5">
      <h2 className="mb-3 text-[15px] font-semibold uppercase tracking-[0.04em] text-neutral-900">
        <span className="text-bmw-blue">{n}.</span> {title}
      </h2>
      {children}
    </section>
  );
}

function RequirementBlock({ r, options }: { r: SpecRequirement; options: SpecOptions }) {
  return (
    <div className="break-inside-avoid border border-neutral-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] text-neutral-500">
          {r.id} · {r.component}
        </p>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
          <span className={clsx("px-2 py-0.5", PRIORITY_STYLE[r.priority])}>{r.priority} priority</span>
          <span className="bg-neutral-100 px-2 py-0.5 text-neutral-700">{humanize(r.status)}</span>
          <span className="bg-neutral-100 px-2 py-0.5 text-neutral-700">{r.evidenceLevel} evidence</span>
          <span className="bg-neutral-900 px-2 py-0.5 text-white">Score {r.score.toFixed(1)}</span>
        </div>
      </div>
      <h3 className="mt-2 text-[14px] font-semibold text-neutral-900">{r.title}</h3>
      <p className="mt-2">{r.statement}</p>

      <Label>Rationale</Label>
      <p>{r.rationale}</p>

      <Label>Verification (proposed)</Label>
      <p>
        <span className="font-medium text-neutral-900">Method:</span> {r.verification.method}.
      </p>
      <p>
        <span className="font-medium text-neutral-900">Acceptance:</span> {r.verification.acceptance}
      </p>
      <p className="text-[11px] text-neutral-500">Basis: {r.verification.basis}</p>

      {options.includeScoreBreakdown && (
        <>
          <Label>Score breakdown</Label>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {r.factors.map((f) => (
                <tr key={f.label} className="border-t border-neutral-100 align-top">
                  <td className="w-[28%] py-1 pr-2 text-neutral-900">{f.label}</td>
                  <td className="w-[14%] py-1 pr-2 font-mono tabular-nums">
                    {f.rawValue} × {f.weightPct}%
                  </td>
                  <td className="py-1 text-neutral-600">{f.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {options.includeReviews && (
        <>
          <Label>Stakeholder review</Label>
          {r.reviews.length === 0 ? (
            <p className="text-neutral-500">No stakeholder review recorded yet.</p>
          ) : (
            r.reviews.map((rev) => (
              <p key={rev.reviewer}>
                <span className="font-medium text-neutral-900">{rev.reviewer}</span> ({rev.decision}): {rev.opinion}
              </p>
            ))
          )}
          {r.history.length > 0 && (
            <>
              <Label>Decision history</Label>
              {r.history.map((h, i) => (
                <p key={i} className="mb-1">
                  <span className="font-mono text-[10.5px] text-neutral-500">{formatDate(h.when)}</span>{" "}
                  <span className="font-medium text-neutral-900">{h.event}</span> <span className="text-neutral-500">({h.actor})</span>: {h.note}
                </p>
              ))}
            </>
          )}
        </>
      )}

      {options.includeEvidence && (
        <>
          <Label>Evidence</Label>
          <p>{r.sourceCount} linked customer verbatims.</p>
          {r.sampleVerbatims.map((v) => (
            <p key={v} className="mt-1 border-l-2 border-neutral-300 pl-3 italic text-neutral-600">
              “{v}”
            </p>
          ))}
          {r.assumptions.length > 0 && <ListBlock title="Assumptions" items={r.assumptions} />}
          {r.uncertainties.length > 0 && <ListBlock title="Uncertainties" items={r.uncertainties} />}
        </>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">{children}</p>;
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-2">
      <p className="font-medium text-neutral-900">{title}</p>
      <ul className="list-disc pl-5 text-neutral-600">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
