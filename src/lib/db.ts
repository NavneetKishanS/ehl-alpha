// In-memory data store for the hackathon v0.
// Swap-out point for Role A: replace this module's internals with a real
// DB (Postgres/Prisma or SQLite) while keeping the exported function
// signatures identical so nothing above this layer has to change.
//
// Survives Next.js dev-mode hot reload by hanging off globalThis.

import { nanoid } from "nanoid";
import type {
  Vehicle,
  VehicleComponent,
  Workflow,
  Requirement,
  Signal,
  SourceRecord,
  Stakeholder,
  StakeholderReview,
  AuditLogEntry,
  AISummary,
  Actor,
  AuditAction,
} from "./types";
import { buildSeed } from "./seed";

interface Store {
  vehicles: Vehicle[];
  components: VehicleComponent[];
  workflows: Workflow[];
  requirements: Requirement[];
  signals: Signal[];
  sources: SourceRecord[];
  stakeholders: Stakeholder[];
  reviews: StakeholderReview[];
  auditLog: AuditLogEntry[];
  aiSummaries: AISummary[];
}

const globalForStore = globalThis as unknown as { __ehlStore?: Store };

function freshStore(): Store {
  return buildSeed();
}

export const store: Store = globalForStore.__ehlStore ?? (globalForStore.__ehlStore = freshStore());

// ---------- append-only audit log ----------

export function logAction(entry: {
  workflowId: string;
  actor: Actor;
  action: AuditAction;
  targetType: AuditLogEntry["targetType"];
  targetId: string;
  oldValue: unknown;
  newValue: unknown;
  rationale: string;
}): AuditLogEntry {
  const full: AuditLogEntry = {
    id: `log_${nanoid(8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  store.auditLog.push(full);
  return full;
}

export function getAuditLog(workflowId: string): AuditLogEntry[] {
  return store.auditLog
    .filter((l) => l.workflowId === workflowId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// ---------- vehicles / components ----------

export function listVehicles(): Vehicle[] {
  return store.vehicles;
}

export function getVehicle(id: string): Vehicle | undefined {
  return store.vehicles.find((v) => v.id === id);
}

export function listComponents(vehicleId: string): VehicleComponent[] {
  return store.components.filter((c) => c.vehicleId === vehicleId);
}

export function getComponent(componentId: string): VehicleComponent | undefined {
  return store.components.find((c) => c.id === componentId);
}

// ---------- workflows ----------

export function getWorkflow(workflowId: string): Workflow | undefined {
  return store.workflows.find((w) => w.id === workflowId);
}

export function getWorkflowByComponent(componentId: string): Workflow | undefined {
  const comp = getComponent(componentId);
  if (!comp?.workflowId) return undefined;
  return getWorkflow(comp.workflowId);
}

export function createWorkflow(componentId: string, market: string): Workflow {
  const comp = getComponent(componentId);
  if (!comp) throw new Error("component not found");
  const now = new Date().toISOString();
  const workflow: Workflow = {
    id: `wf_${nanoid(8)}`,
    vehicleId: comp.vehicleId,
    componentId,
    market,
    status: "draft",
    stages: [
      { key: "ingest", label: "Ingest datasets", status: "active", startedAt: now, completedAt: null, owner: "pm" },
      { key: "enrich", label: "Enrich with web knowledge", status: "pending", startedAt: null, completedAt: null, owner: "ai" },
      { key: "extract", label: "Extract signals", status: "pending", startedAt: null, completedAt: null, owner: "ai" },
      { key: "derive", label: "Derive requirements", status: "pending", startedAt: null, completedAt: null, owner: "ai" },
      { key: "score", label: "Score & prioritize", status: "pending", startedAt: null, completedAt: null, owner: "ai" },
      { key: "stakeholder_review", label: "Stakeholder review", status: "pending", startedAt: null, completedAt: null, owner: "stakeholder" },
      { key: "pm_decision", label: "PM decision", status: "pending", startedAt: null, completedAt: null, owner: "pm" },
      { key: "deploy", label: "Move to deploy", status: "pending", startedAt: null, completedAt: null, owner: "pm" },
    ],
    createdAt: now,
    updatedAt: now,
  };
  store.workflows.push(workflow);
  comp.workflowId = workflow.id;

  logAction({
    workflowId: workflow.id,
    actor: { type: "pm", id: "pm_demo", name: "Product Manager" },
    action: "workflow_created",
    targetType: "workflow",
    targetId: workflow.id,
    oldValue: null,
    newValue: { componentId, market },
    rationale: `Started a new requirements workflow for ${comp.label} in ${market}.`,
  });

  return workflow;
}

export function updateStage(
  workflowId: string,
  stageKey: Workflow["stages"][number]["key"],
  status: Workflow["stages"][number]["status"],
  actor: Actor,
) {
  const wf = getWorkflow(workflowId);
  if (!wf) throw new Error("workflow not found");
  const stage = wf.stages.find((s) => s.key === stageKey);
  if (!stage) throw new Error("stage not found");
  const oldStatus = stage.status;
  stage.status = status;
  const now = new Date().toISOString();
  if (status === "active" && !stage.startedAt) stage.startedAt = now;
  if (status === "complete") stage.completedAt = now;
  wf.updatedAt = now;

  logAction({
    workflowId,
    actor,
    action: "stage_transition",
    targetType: "stage",
    targetId: stageKey,
    oldValue: oldStatus,
    newValue: status,
    rationale: `${stage.label}: ${oldStatus} -> ${status}`,
  });
}

// ---------- requirements ----------

export function listRequirements(workflowId: string): Requirement[] {
  return store.requirements
    .filter((r) => r.workflowId === workflowId)
    .sort((a, b) => b.score - a.score);
}

export function getRequirement(id: string): Requirement | undefined {
  return store.requirements.find((r) => r.id === id);
}

export function recomputeScore(req: Requirement): number {
  const totalWeight = req.scoreFactors.reduce((s, f) => s + f.weight, 0) || 1;
  const weighted = req.scoreFactors.reduce((s, f) => s + (f.rawValue * f.weight), 0);
  return Math.round((weighted / totalWeight) * 10) / 10;
}

export function updateRequirementStatus(
  id: string,
  status: Requirement["status"],
  actor: Actor,
  rationale: string,
): Requirement {
  const req = getRequirement(id);
  if (!req) throw new Error("requirement not found");
  const oldStatus = req.status;
  req.status = status;
  req.updatedAt = new Date().toISOString();

  const actionMap: Record<Requirement["status"], AuditAction> = {
    proposed: "requirement_edited",
    approved: "requirement_approved",
    rejected: "requirement_rejected",
    postponed: "requirement_postponed",
    challenged: "requirement_challenged",
  };

  logAction({
    workflowId: req.workflowId,
    actor,
    action: actionMap[status],
    targetType: "requirement",
    targetId: req.id,
    oldValue: oldStatus,
    newValue: status,
    rationale,
  });

  return req;
}

export function updateWeights(
  requirementId: string,
  weights: Record<string, number>,
  actor: Actor,
): Requirement {
  const req = getRequirement(requirementId);
  if (!req) throw new Error("requirement not found");
  const oldScore = req.score;
  req.scoreFactors = req.scoreFactors.map((f) => ({
    ...f,
    weight: weights[f.key] ?? f.weight,
  }));
  req.score = recomputeScore(req);
  req.updatedAt = new Date().toISOString();

  logAction({
    workflowId: req.workflowId,
    actor,
    action: "weights_adjusted",
    targetType: "requirement",
    targetId: req.id,
    oldValue: { score: oldScore },
    newValue: { score: req.score, weights },
    rationale: "PM adjusted scoring factor weights.",
  });

  return req;
}

// Applies an AI re-assessment (e.g. after a PM challenge) to a requirement's
// score inputs and evidence level, recomputes the score, and logs the exact
// before/after values.
export function updateScoreFactors(
  requirementId: string,
  changes: {
    factorUpdates: { key: string; rawValue: number; rationale: string }[];
    evidenceLevel?: Requirement["evidenceLevel"];
  },
  actor: Actor,
  rationale: string,
): Requirement {
  const req = getRequirement(requirementId);
  if (!req) throw new Error("requirement not found");
  const snapshot = () => ({
    score: req.score,
    evidenceLevel: req.evidenceLevel,
    factors: Object.fromEntries(req.scoreFactors.map((f) => [f.key, f.rawValue])),
  });
  const before = snapshot();

  req.scoreFactors = req.scoreFactors.map((f) => {
    const update = changes.factorUpdates.find((u) => u.key === f.key);
    return update ? { ...f, rawValue: update.rawValue, rationale: update.rationale } : f;
  });
  if (changes.evidenceLevel) req.evidenceLevel = changes.evidenceLevel;
  req.score = recomputeScore(req);
  req.updatedAt = new Date().toISOString();

  logAction({
    workflowId: req.workflowId,
    actor,
    action: "score_recomputed",
    targetType: "requirement",
    targetId: req.id,
    oldValue: before,
    newValue: snapshot(),
    rationale,
  });

  return req;
}

// ---------- signals / sources ----------

export function listSignals(workflowId: string): Signal[] {
  return store.signals.filter((s) => s.workflowId === workflowId);
}

export function listSources(workflowId: string): SourceRecord[] {
  return store.sources.filter((s) => s.workflowId === workflowId);
}

export function getSourcesByIds(ids: string[]): SourceRecord[] {
  return store.sources.filter((s) => ids.includes(s.id));
}

export function getSignal(signalId: string): Signal | undefined {
  return store.signals.find((s) => s.id === signalId);
}

// Persists a signal's AI overview once generated (the actual OpenAI call
// lives in the API route, alongside the rest of the AI-orchestration
// routes — db.ts stays synchronous) and logs it like every other AI output
// in the app, so it shows up in the audit trail too.
export function cacheSignalOverview(
  signalId: string,
  overview: { content: string; model: string; live: boolean },
  actor: Actor,
): Signal {
  const signal = getSignal(signalId);
  if (!signal) throw new Error("signal not found");
  signal.aiOverview = { ...overview, generatedAt: new Date().toISOString() };

  logAction({
    workflowId: signal.workflowId,
    actor,
    action: "ai_summary_generated",
    targetType: "signal",
    targetId: signal.id,
    oldValue: null,
    newValue: { live: overview.live, model: overview.model },
    rationale: overview.content,
  });

  return signal;
}

// ---------- stakeholders / reviews ----------

export function listStakeholders(): Stakeholder[] {
  return store.stakeholders;
}

export function getStakeholder(id: string): Stakeholder | undefined {
  return store.stakeholders.find((s) => s.id === id);
}

export function listReviews(workflowId: string): StakeholderReview[] {
  return store.reviews.filter((r) => r.workflowId === workflowId);
}

export function submitReview(
  reviewId: string,
  decision: StakeholderReview["decision"],
  expertOpinion: string,
): StakeholderReview {
  const review = store.reviews.find((r) => r.id === reviewId);
  if (!review) throw new Error("review not found");
  review.decision = decision;
  review.expertOpinion = expertOpinion;
  review.submittedAt = new Date().toISOString();

  const stakeholder = getStakeholder(review.stakeholderId);

  logAction({
    workflowId: review.workflowId,
    actor: { type: "stakeholder", id: review.stakeholderId, name: stakeholder?.name ?? "Stakeholder" },
    action: "stakeholder_review_submitted",
    targetType: "review",
    targetId: review.id,
    oldValue: { decision: "pending" },
    newValue: { decision, expertOpinion },
    rationale: expertOpinion,
  });

  return review;
}

// PM tags one or more stakeholders to review a specific requirement.
// Skips anyone already assigned (idempotent — calling it twice with an
// overlapping set only creates the new ones). Each new review starts
// pending, with a snapshot of the requirement's current evidence so the
// stakeholder sees what the PM saw at assignment time, not a moving target.
export function assignReviewers(requirementId: string, stakeholderIds: string[], actor: Actor): StakeholderReview[] {
  const req = getRequirement(requirementId);
  if (!req) throw new Error("requirement not found");

  const alreadyAssigned = new Set(store.reviews.filter((r) => r.requirementId === requirementId).map((r) => r.stakeholderId));
  const toAssign = stakeholderIds.filter((id) => !alreadyAssigned.has(id));

  const created: StakeholderReview[] = toAssign.map((stakeholderId) => {
    const stakeholder = getStakeholder(stakeholderId);
    const review: StakeholderReview = {
      id: `rev_${nanoid(8)}`,
      workflowId: req.workflowId,
      stakeholderId,
      requirementId: req.id,
      decision: "pending",
      expertOpinion: "",
      submittedAt: null,
      aiContextSnapshot: `Signal: ${req.title} (${req.evidenceLevel} evidence, score ${req.score.toFixed(1)}).`,
    };
    store.reviews.push(review);

    logAction({
      workflowId: req.workflowId,
      actor,
      action: "review_requested",
      targetType: "review",
      targetId: review.id,
      oldValue: null,
      newValue: { stakeholderId, requirementId: req.id },
      rationale: `Sent "${req.title}" to ${stakeholder?.name ?? stakeholderId} for review.`,
    });
    return review;
  });

  return created;
}

// ---------- AI summaries ----------

// Newest first, so `summaries.find((s) => s.type === ...)` in the UI always
// picks up the latest regenerated summary rather than the seeded one.
export function listAISummaries(workflowId: string): AISummary[] {
  return store.aiSummaries
    .filter((s) => s.workflowId === workflowId)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export function addAISummary(summary: Omit<AISummary, "id" | "generatedAt">, model = "gpt-4.1"): AISummary {
  const full: AISummary = {
    ...summary,
    id: `aisum_${nanoid(8)}`,
    generatedAt: new Date().toISOString(),
  };
  store.aiSummaries.push(full);

  logAction({
    workflowId: summary.workflowId,
    actor: { type: "ai", id: "ai_engine", name: "Requirements Copilot", model },
    action: "ai_summary_generated",
    targetType: "workflow",
    targetId: summary.workflowId,
    oldValue: null,
    newValue: { type: summary.type },
    rationale: "Regenerated summary from latest audit log entries.",
  });

  return full;
}
