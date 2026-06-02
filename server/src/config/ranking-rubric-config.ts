export const RUBRIC_CATEGORY_MAX_POINTS = {
  governance: 10,
  accountability: 25,
  impactEvidence: 30,
  financialEfficiency: 30,
  politicalRisk: 5,
} as const

export const RUBRIC_TOTAL_MAX_POINTS =
  RUBRIC_CATEGORY_MAX_POINTS.governance +
  RUBRIC_CATEGORY_MAX_POINTS.accountability +
  RUBRIC_CATEGORY_MAX_POINTS.impactEvidence +
  RUBRIC_CATEGORY_MAX_POINTS.financialEfficiency +
  RUBRIC_CATEGORY_MAX_POINTS.politicalRisk

export const ANIMAL_IMPACT_KEYWORDS = [
  "rescued",
  "rescue",
  "adopted",
  "adoption",
  "sanctuary",
  "veterinary",
  "vet ",
  "wildlife",
  "cruelty",
  "investigation",
  "policy",
  "legal win",
  "protected",
  "animals helped",
  "outcome",
  "measurable",
  "year-over-year",
  "lives saved",
] as const

export const IDENTITY_CONFUSION_KEYWORDS = [
  "alias",
  "similar name",
  "identity mismatch",
  "name mismatch",
  "wrong organization",
  "not the same",
  "confusing name",
  "unclear identity",
] as const

export const REVOKED_STATUS_KEYWORDS = ["revoked", "not exempt", "lost 501", "501(c)(3) revoked"] as const
