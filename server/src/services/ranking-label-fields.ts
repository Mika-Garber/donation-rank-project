import type { Organization, RankingStatus, Recommendation } from "../types/organization.js"

export const LEGACY_RANKING_STATUS_VALUES = [
  "Verified Ranking",
  "Partially Verified",
  "Preliminary Only",
] as const

export const LEGACY_RECOMMENDATION_VALUES = ["Keep Small Until Verified"] as const

const LEGACY_RANKING_STATUS_ALIASES = {
  "Verified Ranking": "Research Complete",
  "Partially Verified": "Research Partial",
  "Preliminary Only": "Preliminary",
} as const satisfies Record<string, RankingStatus>

export function normalizeRankingStatus(status: string | RankingStatus | undefined | null): RankingStatus {
  if (!status) return "Not Researched"
  if (status in LEGACY_RANKING_STATUS_ALIASES) {
    return LEGACY_RANKING_STATUS_ALIASES[status as keyof typeof LEGACY_RANKING_STATUS_ALIASES]
  }
  return status as RankingStatus
}

export function normalizeRecommendation(
  recommendation: string | Recommendation | undefined | null,
): Recommendation {
  if (!recommendation) return "Review Before Donating"
  if (recommendation === "Keep Small Until Verified") return "Keep Small Until Research Complete"
  return recommendation as Recommendation
}

export function organizationHasLegacyRankingLabels(organization: Record<string, unknown>): boolean {
  const rankingStatus = organization.rankingStatus
  if (typeof rankingStatus === "string" && rankingStatus in LEGACY_RANKING_STATUS_ALIASES) return true
  const recommendation = organization.recommendation
  if (recommendation === "Keep Small Until Verified") return true
  const scoreBreakdown = organization.scoreBreakdown
  if (scoreBreakdown && typeof scoreBreakdown === "object") {
    return organizationHasLegacyRankingLabels(scoreBreakdown as Record<string, unknown>)
  }
  return false
}

export function applyCanonicalRankingLabels(organization: Organization): Organization {
  const rankingStatus = normalizeRankingStatus(organization.rankingStatus)
  const recommendation = normalizeRecommendation(organization.recommendation)
  const scoreBreakdown = organization.scoreBreakdown
    ? {
        ...organization.scoreBreakdown,
        rankingStatus: normalizeRankingStatus(organization.scoreBreakdown.rankingStatus),
        recommendation: normalizeRecommendation(organization.scoreBreakdown.recommendation),
      }
    : organization.scoreBreakdown

  return {
    ...organization,
    rankingStatus,
    recommendation,
    scoreBreakdown,
  }
}
