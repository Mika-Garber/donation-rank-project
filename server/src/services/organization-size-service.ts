import type { Organization } from "../types/organization.js"

export type OrganizationSize = "micro" | "small" | "mid" | "large" | "unknown"

const LOCAL_SIZE_KEYWORDS = ["local", "community", "regional", "shelter", "rescue", "sanctuary", "county", "town"]

function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return String(value)
}

function hasAllFinancialRatios(organization: Organization): boolean {
  return (
    organization.programPercent !== null &&
    organization.fundraisingPercent !== null &&
    organization.adminPercent !== null
  )
}

function looksLocal(organization: Organization): boolean {
  const haystack = `${toSafeString(organization.subcategory)} ${toSafeString(organization.category)} ${toSafeString(organization.notes)}`.toLowerCase()
  return LOCAL_SIZE_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

export function classifyOrganizationSize(organization: Organization): OrganizationSize {
  const hasFinancials = hasAllFinancialRatios(organization)
  const hasWatchdogRating = organization.charityNavigatorRating !== null || Boolean(organization.charityWatchGrade)

  if (!hasFinancials && !hasWatchdogRating) {
    return looksLocal(organization) ? "micro" : "small"
  }

  if (hasFinancials && hasWatchdogRating) {
    return "large"
  }

  if (hasFinancials) {
    return "mid"
  }

  return "unknown"
}

export function isSmallGiftTrack(size: OrganizationSize): boolean {
  return size === "micro" || size === "small"
}
