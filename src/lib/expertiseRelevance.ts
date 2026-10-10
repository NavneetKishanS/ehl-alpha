import type { RequirementCategory, StakeholderExpertise } from "./types";

// Which requirement categories fall inside a stakeholder's domain, for
// filtering the "evidence packet" shown on their review page down to what's
// actually relevant to them instead of the whole workflow.
//
// legal_regulatory and procurement are deliberately sparse here: legal
// concerns (e.g. "this claim needs substantiation before marketing use")
// cut across every category rather than belonging to one, and procurement
// cares about sourcing/packaging specifics more than product categories.
// That's exactly why this filter is never the only thing deciding what a
// stakeholder sees — see isRelevantToStakeholder below.
const CATEGORY_RELEVANCE: Record<StakeholderExpertise, RequirementCategory[]> = {
  engineering: ["comfort", "space", "usability", "infotainment_digital", "driving_experience", "range_charging"],
  sales: ["usability", "infotainment_digital", "driving_experience", "range_charging", "variants_packages", "space"],
  design: ["comfort", "space", "design_quality"],
  brand: ["design_quality", "infotainment_digital", "driving_experience", "variants_packages"],
  legal_regulatory: [],
  procurement: ["variants_packages"],
};

export function isCategoryRelevant(category: RequirementCategory, expertise: StakeholderExpertise): boolean {
  return CATEGORY_RELEVANCE[expertise].includes(category);
}

// The actual filter to use: relevant-by-domain OR explicitly assigned a
// review. The "OR assigned" half is load-bearing — it's what keeps e.g.
// Legal from losing visibility into a range_charging requirement they were
// specifically asked to review on a process ground, just because
// "range_charging" isn't in their domain's category list.
export function isRelevantToStakeholder(
  category: RequirementCategory,
  expertise: StakeholderExpertise,
  hasAssignedReview: boolean,
): boolean {
  return hasAssignedReview || isCategoryRelevant(category, expertise);
}
