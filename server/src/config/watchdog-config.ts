export const CHARITY_NAVIGATOR_API_URL =
  process.env.CHARITY_NAVIGATOR_API_URL ?? "https://api.charitynavigator.org/graphql"

export function getCharityNavigatorApiKey(): string {
  return process.env.CHARITY_NAVIGATOR_API_KEY?.trim() ?? ""
}

export function isCharityNavigatorConfigured(): boolean {
  return getCharityNavigatorApiKey().length > 0
}

export const CHARITYWATCH_GRADE_SCORES: Record<string, number> = {
  "A+": 98,
  A: 92,
  "B+": 84,
  B: 76,
  "C+": 68,
  C: 60,
  D: 45,
  F: 25,
}

export const ACE_RECOMMENDATION_SCORES = {
  Recommended: 95,
  Standout: 82,
} as const
