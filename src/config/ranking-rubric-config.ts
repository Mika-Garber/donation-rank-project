/** Every rubric category is scored 0–100. Weights in server ranking-config combine them into the total. */
export const RUBRIC_CATEGORY_MAX_POINTS = {
  governance: 100,
  accountability: 100,
  impactEvidence: 100,
  financialEfficiency: 100,
  politicalRisk: 100,
} as const

export type RubricCategoryKey = keyof typeof RUBRIC_CATEGORY_MAX_POINTS

export function getCategoryMaxPoints(key: string): number {
  if (key in RUBRIC_CATEGORY_MAX_POINTS) {
    return RUBRIC_CATEGORY_MAX_POINTS[key as RubricCategoryKey]
  }
  return 100
}
