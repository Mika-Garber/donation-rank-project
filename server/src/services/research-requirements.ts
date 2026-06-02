import type { Organization, ResearchStatus } from "../types/organization.js"

export const CORE_REQUIRED_FIELDS = ["website", "ein", "is501c3Verified"] as const
export const FINANCIAL_PREFERRED_FIELDS = ["programPercent", "fundraisingPercent", "adminPercent"] as const
export const RATING_OPTIONAL_FIELDS = ["charityNavigatorRating"] as const

export const REQUIRED_RESEARCH_FIELDS = [
  ...CORE_REQUIRED_FIELDS,
  ...FINANCIAL_PREFERRED_FIELDS,
  ...RATING_OPTIONAL_FIELDS,
] as const

export type RequiredResearchField = (typeof REQUIRED_RESEARCH_FIELDS)[number]

function hasFieldValue(organization: Organization, field: RequiredResearchField): boolean {
  const value = organization[field]
  return !(value === null || value === "")
}

export function getMissingResearchFields(organization: Organization): RequiredResearchField[] {
  return REQUIRED_RESEARCH_FIELDS.filter((field) => !hasFieldValue(organization, field))
}

export function getResearchCompletenessPercent(organization: Organization): number {
  const presentCount = REQUIRED_RESEARCH_FIELDS.filter((field) => hasFieldValue(organization, field)).length
  return Math.round((presentCount / REQUIRED_RESEARCH_FIELDS.length) * 1000) / 10
}

export function getWeightedResearchCompletenessPercent(organization: Organization): number {
  const corePresent = CORE_REQUIRED_FIELDS.filter((field) => hasFieldValue(organization, field)).length
  const financialPresent = FINANCIAL_PREFERRED_FIELDS.filter((field) => hasFieldValue(organization, field)).length
  const ratingPresent = RATING_OPTIONAL_FIELDS.filter((field) => hasFieldValue(organization, field)).length

  const coreScore = (corePresent / CORE_REQUIRED_FIELDS.length) * 70
  const financialScore = (financialPresent / FINANCIAL_PREFERRED_FIELDS.length) * 20
  const ratingScore = (ratingPresent / RATING_OPTIONAL_FIELDS.length) * 10

  return Math.round((coreScore + financialScore + ratingScore) * 10) / 10
}

export function getMissingCoreFields(organization: Organization): RequiredResearchField[] {
  return CORE_REQUIRED_FIELDS.filter((field) => !hasFieldValue(organization, field))
}

export function getMissingFinancialFields(organization: Organization): RequiredResearchField[] {
  return FINANCIAL_PREFERRED_FIELDS.filter((field) => !hasFieldValue(organization, field))
}

export function getResearchStatusFromFields(
  organization: Organization,
  fallbackStatus: ResearchStatus,
): ResearchStatus {
  const missingCoreFields = getMissingCoreFields(organization)
  const missingFields = getMissingResearchFields(organization)
  if (missingFields.length === REQUIRED_RESEARCH_FIELDS.length) return fallbackStatus
  if (missingCoreFields.length === 0 && missingFields.length === 0) return "complete"
  if (missingCoreFields.length === 0) return "partial"
  return "partial"
}
