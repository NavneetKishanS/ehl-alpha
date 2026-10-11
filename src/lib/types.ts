// Shared domain types for the BMW PM Decision Workflow app.
// This is the contract every role builds against. Changing a shape here
// is a team-wide announcement, not a solo edit.

export type ComponentKey =
  | "exterior"
  | "interior"
  | "windows"
  | "steering"
  | "engine"
  | "battery";

export interface Vehicle {
  id: string;
  name: string; // e.g. "BMW 5 Series"
  generation: string; // e.g. "G60 -> successor"
  markets: string[]; // e.g. ["Europe", "China", "United States"]
}

export interface VehicleComponent {
  id: string;
  vehicleId: string;
  key: ComponentKey;
  label: string; // "Battery & Charging"
  hotspot: { xPct: number; yPct: number }; // position on the 360 viewer, 0-100
  workflowId: string | null; // null => "create new" affordance on landing page
}

// ---------- Workflow / pipeline ----------

export type WorkflowStatus =
  | "draft"
  | "analyzing"
  | "stakeholder_review"
  | "pm_review"
  | "approved"
  | "rejected"
  | "archived";

export type StageKey =
  | "ingest"
  | "enrich"
  | "extract"
  | "derive"
  | "score"
  | "stakeholder_review"
  | "pm_decision"
  | "deploy";

export type StageStatus = "pending" | "active" | "complete" | "blocked" | "skipped";

export interface Stage {
  key: StageKey;
  label: string;
  status: StageStatus;
  startedAt: string | null;
  completedAt: string | null;
  owner: "ai" | "pm" | "stakeholder";
}

export interface Workflow {
  id: string;
  vehicleId: string;
  componentId: string;
  market: string;
  status: WorkflowStatus;
  stages: Stage[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Evidence chain: sources -> signals -> requirements ----------

export type DatasetType = "verbatim" | "equipment" | "sales" | "study" | "web";
export type ReliabilityTier = "first_party" | "official" | "review_site" | "forum";

export interface SourceRecord {
  id: string;
  workflowId: string;
  datasetType: DatasetType;
  reliability: ReliabilityTier;
  title: string;
  excerpt: string;
  url: string | null; // null for internal datasets
  retrievedAt: string;
  // Optional metadata, populated when a source is derived from real
  // ingested data (see scripts/ingest-real-data.ts). Lets the Evidence
  // Explorer filter without re-parsing the excerpt text.
  country?: string;
  engineType?: string;
  feedbackType?: string;
}

// ---------- Real ingested datasets (scripts/ingest-real-data.ts output) ----------

// A single row from a Feedback_Explorer dataset, trimmed for the Evidence
// Explorer table. Not tied to a workflow — these are the raw substrate
// signals/requirements get derived from, browsable independent of any one
// component's workflow.
export interface FeedbackRecord {
  id: string;
  vehicleCode: string; // "F70" | "G60" | "G70"
  country: string;
  engineType: string; // "ICE" | "BEVE" | "PHEV"
  feedbackType: string | null; // "Likes" | "Wants" | "Difficult to Use" | "Defect" | null
  text: string;
  vfcLevel2: string | null;
  vfcLevel3: string | null;
  component: ComponentKey | "general";
}

export interface SalesVolume {
  vehicleCode: string;
  market: string;
  marketCode: string;
  volume2024: number;
  volume2025: number;
  volume2030: number;
}

// A category x model customer-study benchmark row. CN/EU rows are a direct
// 0-10 mean; US rows are reconstructed from a satisfaction-bucket
// distribution (see ingest script) — methodology is recorded explicitly so
// the UI/AI never treats the two as equivalent-precision evidence.
export interface CustomerStudyScore {
  category: string;
  model: string; // e.g. "BMW 5 Series G60"
  region: "CN" | "EU" | "US";
  mean: number; // normalized 0-10
  methodology: "direct_mean" | "distribution_derived";
}

export interface Signal {
  id: string;
  workflowId: string;
  theme: string;
  frequency: number;
  sentiment: "positive" | "negative" | "mixed" | "neutral";
  sampleVerbatims: string[];
  sourceIds: string[];
  contradicts: string[]; // other signal ids this one conflicts with
}

export type EvidenceLevel = "strong" | "moderate" | "weak";
export type RequirementCategory =
  | "comfort"
  | "space"
  | "usability"
  | "infotainment_digital"
  | "design_quality"
  | "driving_experience"
  | "range_charging"
  | "variants_packages";

export type RequirementStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "postponed"
  | "challenged";

export interface ScoreFactor {
  key: string; // "customer_impact" | "frequency" | ...
  label: string;
  weight: number; // 0-1, factors across a requirement sum to 1
  rawValue: number; // 0-100 input value before weighting
  rationale: string;
}

export interface Requirement {
  id: string;
  workflowId: string;
  title: string;
  description: string;
  category: RequirementCategory;
  status: RequirementStatus;
  evidenceLevel: EvidenceLevel;
  assumptions: string[];
  uncertainties: string[];
  linkedSignalIds: string[];
  linkedSourceIds: string[];
  scoreFactors: ScoreFactor[];
  score: number; // computed weighted score, 0-100
  effort: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
}

// ---------- Stakeholders ----------

export type StakeholderExpertise =
  | "engineering"
  | "sales"
  | "design"
  | "legal_regulatory"
  | "brand"
  | "procurement";

export interface Stakeholder {
  id: string;
  name: string;
  expertise: StakeholderExpertise;
  avatarColor: string;
}

export type ReviewDecision = "approve" | "reject" | "pending";

export interface StakeholderReview {
  id: string;
  workflowId: string;
  stakeholderId: string;
  requirementId: string | null; // null = review covers whole workflow
  decision: ReviewDecision;
  expertOpinion: string;
  submittedAt: string | null;
  aiContextSnapshot: string; // the AI summary shown to the stakeholder at submit time
}

// ---------- Audit log (append-only) ----------

export type ActorType = "ai" | "pm" | "stakeholder";

export interface Actor {
  type: ActorType;
  id: string;
  name: string;
  model?: string; // e.g. "claude-sonnet-5" when type === "ai"
}

export type AuditAction =
  | "workflow_created"
  | "stage_transition"
  | "signal_extracted"
  | "requirement_proposed"
  | "requirement_edited"
  | "requirement_approved"
  | "requirement_rejected"
  | "requirement_postponed"
  | "requirement_challenged"
  | "score_recomputed"
  | "stakeholder_review_submitted"
  | "review_requested"
  | "ai_summary_generated"
  | "weights_adjusted";

export interface AuditLogEntry {
  id: string;
  workflowId: string;
  actor: Actor;
  action: AuditAction;
  targetType: "workflow" | "requirement" | "stage" | "review";
  targetId: string;
  oldValue: unknown;
  newValue: unknown;
  rationale: string;
  timestamp: string;
}

// ---------- AI summaries ----------

export interface AISummary {
  id: string;
  workflowId: string;
  type: "decision_trail" | "stakeholder_overview" | "limitations";
  content: string;
  basedOnLogIds: string[];
  generatedAt: string;
}
