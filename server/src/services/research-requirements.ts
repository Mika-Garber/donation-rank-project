import { SOURCE_RELIABILITY_BY_TYPE } from "../config/ranking-config.js"
import type {
  FinancialCompletenessStatus,
  ImpactEvidenceLevel,
  LegalVerificationStatus,
  Organization,
  ResearchStatus,
  SourceMeta,
  SourceReliability,
} from "../types/organization.js"
import { impactEvidenceLevelRank } from "./impact-metadata-service.js"

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

function getSourceReliability(source: SourceMeta): SourceReliability {
  if (source.reliability) return source.reliability
  if (source.sourceType) return SOURCE_RELIABILITY_BY_TYPE[source.sourceType]
  return "unknown"
}

function sourceHaystack(source: SourceMeta): string {
  return `${source.sourceType ?? ""} ${source.sourceName}`.toLowerCase()
}

function getCharityNavigatorRating(organization: Organization): number | null {
  return organization.charityNavigatorRating
}

function getCharityWatchGrade(organization: Organization): string | null {
  return organization.charityWatchGrade
}

export function getSourceQualityPercent(organization: Organization): number {
  const sources = Object.values(organization.sourceMeta ?? {})
  if (sources.length === 0) return 0

  let points = 0
  const hasIrsOr990 = sources.some((source) => {
    const haystack = sourceHaystack(source)
    return haystack.includes("irs") || haystack.includes("propublica") || haystack.includes("990")
  })
  const hasCharityNavigator = sources.some((source) => sourceHaystack(source).includes("charity navigator"))
  const highReliabilityCount = sources.filter((source) => getSourceReliability(source) === "high").length
  const websiteOnly =
    sources.length > 0 &&
    sources.every((source) => {
      const haystack = sourceHaystack(source)
      return haystack.includes("website") || haystack.includes("manual")
    })

  if (hasIrsOr990) points += 40
  if (hasCharityNavigator) {
    const rating = getCharityNavigatorRating(organization)
    if (rating !== null && rating >= 3) points += 25
    else if (rating !== null && rating === 2) points += 8
    else if (rating !== null) points += 0
    else points += 15
  }
  if (highReliabilityCount >= 2) points += 20
  if (sources.length >= 3) points += 15
  if (websiteOnly) points = Math.min(points, 25)

  const cwGrade = getCharityWatchGrade(organization)
  if (cwGrade) {
    const normalized = cwGrade.trim().toUpperCase()
    if (normalized === "D" || normalized === "F") points = Math.max(0, points - 20)
    else if (normalized === "C" || normalized === "C+") points = Math.max(0, points - 5)
  }

  return Math.round(Math.min(points, 100) * 10) / 10
}

export interface CategoryVerificationFlags {
  identityVerified: boolean
  financialsVerified: boolean
  impactDocumented: boolean
  politicalReviewed: boolean
}

function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return String(value)
}

export function getCategoryVerificationFlags(organization: Organization): CategoryVerificationFlags {
  const verified501 = toSafeString(organization.is501c3Verified).trim().toLowerCase() === "y"
  const hasEin = Boolean(toSafeString(organization.ein).trim())
  const hasFinancials =
    organization.programPercent !== null &&
    organization.fundraisingPercent !== null &&
    organization.adminPercent !== null

  return {
    identityVerified: hasEin && verified501,
    financialsVerified: hasFinancials,
    impactDocumented: Boolean(toSafeString(organization.impactEvidenceNotes).trim()),
    politicalReviewed: Boolean(toSafeString(organization.politicalInvolvementNotes).trim()),
  }
}

export interface ConfidenceCalculationInput {
  organization: Organization
  researchStatus: ResearchStatus
  financialCompleteness: FinancialCompletenessStatus
  financialStale: boolean
  unclearIdentity: boolean
  legalVerificationStatus: LegalVerificationStatus
  impactEvidenceLevel: ImpactEvidenceLevel
  watchdogReviewRequired: boolean
}

export function calculateConfidenceScore(input: ConfidenceCalculationInput): number {
  const completeness = getWeightedResearchCompletenessPercent(input.organization)
  const sourceQuality = getSourceQualityPercent(input.organization)
  let confidenceScore = completeness * 0.7 + sourceQuality * 0.3

  const hasHighReliabilitySource = Object.values(input.organization.sourceMeta ?? {}).some(
    (source) => getSourceReliability(source) === "high",
  )

  if (input.researchStatus === "complete" && hasHighReliabilitySource) confidenceScore += 6
  else if (input.researchStatus === "partial") confidenceScore += 3
  if (input.researchStatus === "failed") confidenceScore -= 12

  if (input.financialCompleteness === "missing") confidenceScore -= 18
  else if (input.financialCompleteness === "partial") confidenceScore -= 10
  if (input.financialStale) confidenceScore -= 4
  if (input.unclearIdentity) confidenceScore -= 6

  if (input.legalVerificationStatus === "Failed Verification") confidenceScore -= 25
  else if (input.legalVerificationStatus === "Needs Review") confidenceScore -= 10
  else if (input.legalVerificationStatus === "Insufficient Data") confidenceScore -= 8

  if (impactEvidenceLevelRank(input.impactEvidenceLevel) <= 1) confidenceScore -= 5
  else if (impactEvidenceLevelRank(input.impactEvidenceLevel) === 2) confidenceScore -= 2

  if (input.watchdogReviewRequired) confidenceScore -= 12

  if (!toSafeString(input.organization.politicalInvolvementNotes).trim()) confidenceScore -= 2

  return Math.round(Math.max(0, Math.min(confidenceScore, 100)) * 10) / 10
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
