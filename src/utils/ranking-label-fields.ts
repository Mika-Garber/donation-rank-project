import type { RankingStatus, Recommendation } from "../types/organization"

const LEGACY_RANKING_STATUS_ALIASES: Record<string, RankingStatus> = {
  "Verified Ranking": "Research Complete",
  "Partially Verified": "Research Partial",
  "Preliminary Only": "Preliminary",
}

export function normalizeRankingStatus(status: string | RankingStatus | undefined | null): RankingStatus {
  if (!status) return "Not Researched"
  return LEGACY_RANKING_STATUS_ALIASES[status] ?? (status as RankingStatus)
}

export function normalizeRecommendation(
  recommendation: string | Recommendation | undefined | null,
): Recommendation {
  if (!recommendation) return "Review Before Donating"
  if (recommendation === "Keep Small Until Verified") return "Keep Small Until Research Complete"
  return recommendation as Recommendation
}
