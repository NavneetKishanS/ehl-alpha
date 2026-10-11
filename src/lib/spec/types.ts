// The requirements specification the PM sends on: one document per vehicle,
// built from every workflow's requirements. The preview, PDF and Word exports
// all render from this single object so they cannot drift apart.

import type { EvidenceLevel, RequirementCategory, RequirementStatus } from "@/lib/types";

export type SpecPriority = "high" | "medium" | "low";

export interface SpecFactor {
  label: string;
  weightPct: number;
  rawValue: number;
  rationale: string;
}

export interface SpecReview {
  reviewer: string; // "Name — Function"
  decision: "approve" | "reject" | "pending";
  opinion: string;
}

export interface SpecHistoryEntry {
  when: string; // ISO
  actor: string; // "PM", "AI (gpt-4.1)", ...
  event: string; // "Challenged", "Re-scored", ...
  note: string;
}

export interface SpecRequirement {
  id: string; // stable display id, e.g. REQ-G60-BAT-01
  title: string;
  statement: string; // "The vehicle shall ..." (templated from the theme)
  rationale: string; // real feedback numbers
  component: string; // "Battery & Charging"
  category: RequirementCategory;
  status: RequirementStatus;
  priority: SpecPriority;
  score: number;
  evidenceLevel: EvidenceLevel;
  factors: SpecFactor[];
  sourceCount: number;
  sampleVerbatims: string[];
  assumptions: string[];
  uncertainties: string[];
  verification: { method: string; acceptance: string; basis: string };
  reviews: SpecReview[];
  history: SpecHistoryEntry[];
}

export interface SpecFact {
  label: string;
  value: string;
  source: string; // where it comes from, with page number for the report
}

export interface SpecDocument {
  meta: {
    title: string;
    vehicleName: string;
    generation: string;
    version: string;
    generatedAt: string; // ISO
    author: string;
    markets: string[];
  };
  scope: string;
  marketContext: {
    persona: string;
    facts: SpecFact[];
    salesByMarket: { market: string; v2024: number; v2025: number; v2030: number }[];
  };
  requirements: SpecRequirement[];
  glossary: { term: string; definition: string }[];
  notes: string[];
}

export interface SpecOptions {
  includeNonApproved: boolean;
  includeScoreBreakdown: boolean;
  includeReviews: boolean;
  includeEvidence: boolean;
}

export const DEFAULT_SPEC_OPTIONS: SpecOptions = {
  includeNonApproved: true,
  includeScoreBreakdown: true,
  includeReviews: true,
  includeEvidence: true,
};

export function visibleRequirements(doc: SpecDocument, options: SpecOptions): SpecRequirement[] {
  return doc.requirements.filter((r) => options.includeNonApproved || r.status === "approved");
}
