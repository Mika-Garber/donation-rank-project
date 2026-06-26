/** Every rubric category is scored 0–100. Weights in ranking-config.ts combine them into the total. */
export const RUBRIC_CATEGORY_MAX_POINTS = {
  governance: 100,
  accountability: 100,
  impactEvidence: 100,
  financialEfficiency: 100,
  politicalRisk: 100,
} as const

export const RUBRIC_TOTAL_MAX_POINTS = 100

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
  "shelter",
  "humane",
  "spay",
  "neuter",
  "animal protection",
  "animal welfare",
  "no-kill",
  "rehabilitat",
  "veteran",
  "service dog",
  "k9",
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
