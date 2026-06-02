export const RUBRIC_CATEGORY_MAX_POINTS = {
  governance: 10,
  accountability: 25,
  impactEvidence: 30,
  financialEfficiency: 30,
  politicalRisk: 5,
} as const

export type RubricCategoryKey = keyof typeof RUBRIC_CATEGORY_MAX_POINTS

export function getCategoryMaxPoints(key: string): number {
  if (key in RUBRIC_CATEGORY_MAX_POINTS) {
    return RUBRIC_CATEGORY_MAX_POINTS[key as RubricCategoryKey]
  }
  return 100
}
