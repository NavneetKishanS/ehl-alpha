// Assembles the vehicle-level requirements specification from the in-memory
// store (workflows, requirements, reviews) and the ingested data. Server-only.
//
// Everything here comes from recorded data: requirements and scores, stakeholder
// reviews, the audit log, sales volumes, the customer study and the report.
// Nothing is invented. Verification targets are the one derived part: they are
// proposals computed from the customer study / feedback figures, labelled as such.

import { getAuditLog, getVehicle, getWorkflow, listComponents, listRequirements, listReviews, listSignals, listStakeholders } from "@/lib/db";
import { STUDY_CATEGORY_KEYWORDS } from "@/lib/deriveRequirements";
import { loadCustomerStudy, loadFeedback, loadSales } from "@/lib/realData";
import { STRATEGY_EXCERPTS } from "@/lib/strategyContext";
import type { AuditLogEntry, ComponentKey, Requirement, RequirementCategory } from "@/lib/types";
import type { SpecDocument, SpecFact, SpecHistoryEntry, SpecPriority, SpecRequirement, SpecReview } from "./types";

const COMPONENT_CODE: Record<string, string> = {
  battery: "BAT",
  exterior: "EXT",
  interior: "INT",
  windows: "WIN",
  steering: "STE",
  engine: "PWR",
};

const VERIFICATION: Record<RequirementCategory, string> = {
  range_charging: "Customer-study satisfaction survey plus VFC feedback tracking on range and charging themes",
  driving_experience: "Customer-study satisfaction survey plus VFC feedback tracking on driving themes",
  usability: "Usability clinic with task-completion measurement, then VFC feedback tracking",
  infotainment_digital: "Usability clinic and My BMW App / iDrive feedback tracking",
  design_quality: "Customer clinic (design appeal rating) plus build-quality feedback tracking",
  comfort: "Customer clinic (comfort rating) plus VFC feedback tracking",
  space: "Package review against benchmark models plus customer clinic",
  variants_packages: "Take-rate analysis in launch markets plus configurator feedback",
};

function priorityFor(score: number): SpecPriority {
  return score >= 65 ? "high" : score >= 55 ? "medium" : "low";
}

function themeOf(title: string): string {
  const i = title.indexOf(": ");
  return i >= 0 ? title.slice(i + 2) : title;
}

function statementFor(title: string, component: string): string {
  const theme = themeOf(title);
  if (title.startsWith("Reduce friction")) {
    return `The vehicle shall remove the customer pain points reported for "${theme}" (${component}) so that the topic is no longer a recurring source of negative feedback.`;
  }
  if (title.startsWith("Deliver what customers")) {
    return `The vehicle shall offer the capability customers repeatedly ask for under "${theme}" (${component}).`;
  }
  if (title.startsWith("Protect this strength")) {
    return `The vehicle shall retain, at minimum, the current level of "${theme}" (${component}), which customers explicitly praise.`;
  }
  return `The vehicle shall address "${title}" (${component}).`;
}

const MARKET_REGION: Record<string, "EU" | "CN" | "US"> = { Europe: "EU", China: "CN", USA: "US", "United States": "US" };

function modelMatches(model: string, code: string) {
  return model.includes(code) || (code === "G60" && model.includes("G68"));
}

// Proposed acceptance criterion. Preferred basis: the real customer study for
// the component's related categories in the workflow's market (reach the best
// sibling model's score). Fallback: halve the share of negative / request
// feedback on this theme, taken from the requirement's own numbers.
function verificationFor(req: Requirement, componentKey: ComponentKey, vehicleCode: string, market: string) {
  const theme = themeOf(req.title);
  const impact = req.scoreFactors.find((f) => f.key === "customer_impact")?.rawValue ?? 0;
  const method = VERIFICATION[req.category];

  if (req.title.startsWith("Protect this strength")) {
    return { method, acceptance: `Share of positive feedback on "${theme}" stays at or above the current ${impact}% in launch-market tracking.`, basis: "Feedback data" };
  }

  const region = MARKET_REGION[market];
  const keywords = STUDY_CATEGORY_KEYWORDS[componentKey] ?? [];
  const rows = region ? loadCustomerStudy().filter((r) => r.region === region && keywords.some((k) => r.category.toLowerCase().includes(k))) : [];
  const ours = rows.filter((r) => modelMatches(r.model, vehicleCode));
  const others = rows.filter((r) => !modelMatches(r.model, vehicleCode));
  if (ours.length && others.length) {
    const ourMean = ours.reduce((a, r) => a + r.mean, 0) / ours.length;
    const best = Math.max(...others.map((r) => r.mean));
    if (best > ourMean) {
      return {
        method,
        acceptance: `Customer-study satisfaction on related categories (${market}) reaches at least ${best.toFixed(2)}/10, the best current sibling model; today ${ourMean.toFixed(2)}/10.`,
        basis: `Customer study 2025, ${region}`,
      };
    }
    return {
      method,
      acceptance: `Customer-study satisfaction on related categories (${market}) stays at or above ${ourMean.toFixed(2)}/10, already ahead of the best sibling model (${best.toFixed(2)}/10).`,
      basis: `Customer study 2025, ${region}`,
    };
  }
  const target = Math.max(5, Math.round(impact / 2));
  return {
    method,
    acceptance: `Share of feedback on "${theme}" that is negative or a request falls from ${impact}% today to at most ${target}% in launch-market tracking.`,
    basis: "Feedback data",
  };
}

const EVENT_LABEL: Partial<Record<AuditLogEntry["action"], string>> = {
  requirement_proposed: "Proposed",
  requirement_challenged: "Challenged",
  requirement_approved: "Approved",
  requirement_rejected: "Rejected",
  requirement_postponed: "Postponed",
  requirement_edited: "Edited",
  score_recomputed: "Re-scored",
  ai_summary_generated: "AI re-assessment",
};

function historyFor(req: Requirement, log: AuditLogEntry[]): SpecHistoryEntry[] {
  return log
    .filter((l) => l.targetId === req.id && EVENT_LABEL[l.action])
    .slice(-6)
    .map((l) => ({
      when: l.timestamp,
      actor: l.actor.type === "ai" ? `AI${l.actor.model ? ` (${l.actor.model})` : ""}` : l.actor.type === "pm" ? "PM" : l.actor.name,
      event: EVENT_LABEL[l.action] as string,
      note: l.rationale.length > 260 ? `${l.rationale.slice(0, 259)}…` : l.rationale,
    }));
}

function sum(rows: { v: number }[]) {
  return rows.reduce((a, r) => a + r.v, 0);
}

function buildMarketContext(vehicleCode: string, vehicleName: string): SpecDocument["marketContext"] {
  const facts: SpecFact[] = [];

  const sales = loadSales().filter((s) => s.vehicleCode === vehicleCode);
  const salesByMarket = sales.filter((s) => s.volume2025 > 0 || s.volume2030 > 0).map((s) => ({ market: s.market, v2024: s.volume2024, v2025: s.volume2025, v2030: s.volume2030 }));
  if (sales.length) {
    const v25 = sum(sales.map((s) => ({ v: s.volume2025 })));
    const v30 = sum(sales.map((s) => ({ v: s.volume2030 })));
    if (v25 > 0) {
      facts.push({
        label: "Planned volume, all markets",
        value: `${v25.toLocaleString("en-US")} (2025) → ${v30.toLocaleString("en-US")} (2030 est.), ${(((v30 - v25) / v25) * 100).toFixed(0)}%`,
        source: "sales_volumes.xlsx",
      });
    }
    const top = [...sales].sort((a, b) => b.volume2025 - a.volume2025)[0];
    if (top && top.volume2025 > 0) {
      facts.push({ label: "Largest market", value: `${top.market}, ${top.volume2025.toLocaleString("en-US")} units in 2025`, source: "sales_volumes.xlsx" });
    }
  }

  const rows = loadFeedback().filter((r) => r.vehicleCode === vehicleCode);
  let persona = `Customers of the ${vehicleName}.`;
  if (rows.length) {
    const share = (pred: (r: (typeof rows)[number]) => boolean) => Math.round((rows.filter(pred).length / rows.length) * 100);
    const countries = new Map<string, number>();
    for (const r of rows) countries.set(r.country, (countries.get(r.country) ?? 0) + 1);
    const topCountry = [...countries.entries()].sort((a, b) => b[1] - a[1])[0];
    const bev = share((r) => r.engineType === "BEVE");
    const phev = share((r) => r.engineType === "PHEV");
    facts.push({ label: "Customer feedback base", value: `${rows.length.toLocaleString("en-US")} verbatims; ${bev}% battery-electric, ${phev}% plug-in hybrid`, source: "Feedback datasets" });
    persona = `Typical respondent: a ${vehicleName} owner, most often in ${topCountry?.[0] ?? "n/a"} (${Math.round(((topCountry?.[1] ?? 0) / rows.length) * 100)}% of feedback), driving a combustion car in about ${100 - bev - phev}% of cases and electrified in ${bev + phev}%.`;
  }

  const satisfaction = loadCustomerStudy().filter((r) => r.category === "Overall product satisfaction" && modelMatches(r.model, vehicleCode));
  if (satisfaction.length) {
    facts.push({
      label: "Overall product satisfaction (0 to 10)",
      value: satisfaction.map((r) => `${r.region} ${r.mean.toFixed(2)}`).join(", "),
      source: "Customer study 2025",
    });
  }

  const cite = (id: string, label: string) => {
    const ex = STRATEGY_EXCERPTS.find((e) => e.id === id);
    if (ex) facts.push({ label, value: ex.text, source: `BMW Group Report 2025, p. ${ex.page}` });
  };
  facts.push({ label: "All-electric share of BMW Group deliveries", value: "17.9% in 2025 (14.7% in 2024, 4.1% in 2021)", source: "BMW Group Report 2025, p. 9" });
  cite("bmwgr25-p46-neue-klasse", "Neue Klasse platform strategy");
  cite("bmwgr25-p79-series-deliveries", "Model-series deliveries");

  return { persona, facts, salesByMarket };
}

export function buildSpec(vehicleId: string): SpecDocument | null {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) return null;
  const code = vehicleId.replace(/^veh_/, "").toUpperCase();
  const stakeholders = listStakeholders();

  const requirements: SpecRequirement[] = [];

  for (const component of listComponents(vehicleId)) {
    const workflow = component.workflowId ? getWorkflow(component.workflowId) : undefined;
    if (!workflow) continue;
    const reqs = [...listRequirements(workflow.id)].sort((a, b) => b.score - a.score);
    const reviews = listReviews(workflow.id);
    const signals = listSignals(workflow.id);
    const log = getAuditLog(workflow.id);

    reqs.forEach((req, i) => {
      const specReviews: SpecReview[] = reviews
        .filter((r) => r.requirementId === req.id && r.decision !== "pending")
        .map((r) => {
          const sh = stakeholders.find((x) => x.id === r.stakeholderId);
          return { reviewer: sh?.name ?? r.stakeholderId, decision: r.decision, opinion: r.expertOpinion };
        });

      const linkedSignals = signals.filter((s) => req.linkedSignalIds.includes(s.id));
      const samples = linkedSignals.flatMap((s) => s.sampleVerbatims).slice(0, 2).map((t) => (t.length > 220 ? `${t.slice(0, 219)}…` : t));

      requirements.push({
        id: `REQ-${code}-${COMPONENT_CODE[component.key] ?? "GEN"}-${String(i + 1).padStart(2, "0")}`,
        title: req.title,
        statement: statementFor(req.title, component.label),
        rationale: req.description.replace(/\s*Representative feedback:[\s\S]*$/, ""),
        component: component.label,
        category: req.category,
        status: req.status,
        priority: priorityFor(req.score),
        score: req.score,
        evidenceLevel: req.evidenceLevel,
        factors: req.scoreFactors.map((f) => ({ label: f.label, weightPct: Math.round(f.weight * 100), rawValue: f.rawValue, rationale: f.rationale })),
        sourceCount: req.linkedSourceIds.length,
        sampleVerbatims: samples,
        assumptions: req.assumptions,
        uncertainties: req.uncertainties,
        verification: verificationFor(req, component.key, code, workflow.market),
        reviews: specReviews,
        history: historyFor(req, log),
      });
    });
  }

  const market = buildMarketContext(code, vehicle.name);
  const notes = [
    "Requirements, scores, reviews and decision history are taken from the recorded workflow data; stakeholder reviews appear only where a reviewer has submitted one.",
    "Verification targets are proposals computed from the customer study or feedback figures shown in each requirement; they are not yet agreed with R&D.",
  ];

  return {
    meta: {
      title: `${vehicle.name} successor: requirements specification`,
      vehicleName: vehicle.name,
      generation: vehicle.generation,
      version: "0.1 (draft)",
      generatedAt: new Date().toISOString(),
      author: "Product Manager",
      markets: vehicle.markets,
    },
    scope: `This document lists the customer-facing requirements proposed for the successor of the ${vehicle.name} (${vehicle.generation}) in ${vehicle.markets.join(", ")}. Each requirement is derived from real customer feedback, sales volumes and customer-study data, scored with the weighted model described in section 4, and reviewed by stakeholders where reviews have been submitted. Engineering specifications, regulatory requirements and business-case calculations are out of scope.`,
    marketContext: market,
    requirements,
    glossary: [
      { term: "VFC", definition: "Vehicle Feedback Classification, BMW's own taxonomy for customer feedback." },
      { term: "Verbatim", definition: "A single piece of free-text customer feedback." },
      { term: "Evidence level", definition: "Strong (15 or more verbatims), moderate (5 to 14) or weak (fewer than 5)." },
      { term: "Score", definition: "Weighted average (0 to 100) of customer impact, frequency, sales relevance, competitive gap, strategic fit, feasibility and evidence strength." },
    ],
    notes,
  };
}
