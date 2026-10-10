// Thin typed fetch wrappers around the API routes. Frontend roles (C & D)
// should only ever talk to the backend through this file, never fetch()
// directly in a component — if the API contract changes, this is the one
// file that needs an update.

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
  ReviewDecision,
} from "./types";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listVehicles: () => fetch("/api/vehicles").then((r) => j<Vehicle[]>(r)),

  listComponents: (vehicleId: string) =>
    fetch(`/api/components?vehicleId=${encodeURIComponent(vehicleId)}`).then((r) => j<VehicleComponent[]>(r)),

  getWorkflowByComponent: (componentId: string) =>
    fetch(`/api/workflows/by-component/${componentId}`).then((r) => (r.status === 404 ? null : j<Workflow>(r))),

  getWorkflow: (id: string) => fetch(`/api/workflows/${id}`).then((r) => j<Workflow>(r)),

  createWorkflow: (componentId: string, market: string) =>
    fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ componentId, market }),
    }).then((r) => j<Workflow>(r)),

  listRequirements: (workflowId: string) =>
    fetch(`/api/workflows/${workflowId}/requirements`).then((r) => j<Requirement[]>(r)),

  getRequirement: (id: string) => fetch(`/api/requirements/${id}`).then((r) => j<Requirement>(r)),

  updateRequirementStatus: (id: string, status: Requirement["status"], rationale?: string) =>
    fetch(`/api/requirements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rationale }),
    }).then((r) => j<Requirement>(r)),

  updateWeights: (id: string, weights: Record<string, number>) =>
    fetch(`/api/requirements/${id}/weights`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights }),
    }).then((r) => j<Requirement>(r)),

  challengeRequirement: (id: string, argument: string) =>
    fetch(`/api/requirements/${id}/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ argument }),
    }).then((r) => j<{ changed: boolean; explanation: string }>(r)),

  getSignals: (workflowId: string) =>
    fetch(`/api/workflows/${workflowId}/signals`).then((r) => j<{ signals: Signal[]; sources: SourceRecord[] }>(r)),

  getAuditLog: (workflowId: string) =>
    fetch(`/api/workflows/${workflowId}/audit-log`).then((r) => j<AuditLogEntry[]>(r)),

  getAISummaries: (workflowId: string) =>
    fetch(`/api/workflows/${workflowId}/ai-summaries`).then((r) => j<AISummary[]>(r)),

  listStakeholders: () => fetch("/api/stakeholders").then((r) => j<Stakeholder[]>(r)),

  listReviews: (workflowId: string) =>
    fetch(`/api/workflows/${workflowId}/reviews`).then((r) => j<StakeholderReview[]>(r)),

  submitReview: (reviewId: string, decision: ReviewDecision, expertOpinion: string) =>
    fetch(`/api/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, expertOpinion }),
    }).then((r) => j<StakeholderReview>(r)),
};
