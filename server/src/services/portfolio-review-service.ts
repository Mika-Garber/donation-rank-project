import type {
  MissionOverlapGroupSummary,
  Organization,
  PortfolioConsolidationSummary,
  PortfolioReviewOrganizationSummary,
  PortfolioReviewResponse,
  Recommendation,
} from "../types/organization.js"
import { impactSourceTierLabel } from "./impact-metadata-service.js"
import { resolveObjectiveStewardshipScore } from "./stewardship-score-fields.js"

const CONTINUE_RECOMMENDATIONS: Recommendation[] = ["Priority Fund", "Keep"]
const STRONG_RECOMMENDATIONS: Recommendation[] = ["Priority Fund", "Keep"]
const HIGH_GIFT_OUTLIER_MIN = 200
const SUGGESTED_FOCUS_MIN = 15
const SUGGESTED_FOCUS_MAX = 20

function formatListRankLabel(listRank: number, listSize: number): string {
  if (listSize <= 1) return "Only org in list"
  const percentile = listRank / listSize
  if (listRank === 1) return `#1 of ${listSize} in list`
  if (percentile <= 0.25) return `#${listRank} of ${listSize} — top quarter`
  if (percentile <= 0.5) return `#${listRank} of ${listSize} — upper half`
  if (percentile <= 0.75) return `#${listRank} of ${listSize} — lower half`
  return `#${listRank} of ${listSize} — bottom quarter`
}

function toReviewSummary(organization: Organization, totalAnnualGiving: number): PortfolioReviewOrganizationSummary {
  let reviewFlag: string | null = null

  if (
    organization.approximateAnnualDonation >= HIGH_GIFT_OUTLIER_MIN &&
    !STRONG_RECOMMENDATIONS.includes(organization.recommendation)
  ) {
    reviewFlag = "High annual gift with weaker recommendation"
  } else if (organization.rankingStatus === "Research Partial" && organization.approximateAnnualDonation >= 100) {
    reviewFlag = "Meaningful gift but research is incomplete"
  } else if (organization.financialEfficiencyStatus === "unknown" && organization.approximateAnnualDonation >= 100) {
    reviewFlag = "Missing verified financial ratios"
  }

  if (organization.watchdogReviewRequired) {
    reviewFlag = reviewFlag ? `${reviewFlag}; Watchdog review recommended` : "Watchdog review recommended"
  }
  if (organization.advocacyReviewStatus === "donor_comfort_review") {
    reviewFlag = reviewFlag ? `${reviewFlag}; Donor comfort review recommended` : "Donor comfort review recommended"
  } else if (organization.advocacyReviewStatus === "partisan_red_flag") {
    reviewFlag = reviewFlag ? `${reviewFlag}; Partisan activity review recommended` : "Partisan activity review recommended"
  } else if (organization.advocacyReviewStatus === "notes_missing") {
    reviewFlag = reviewFlag ? `${reviewFlag}; Advocacy notes missing` : "Advocacy notes missing"
  } else if (organization.advocacyReviewStatus === "not_reviewed") {
    reviewFlag = reviewFlag ? `${reviewFlag}; Advocacy not reviewed` : "Advocacy not reviewed"
  }

  return {
    id: organization.id,
    organizationName: organization.organizationName,
    approximateAnnualDonation: Math.round(organization.approximateAnnualDonation),
    objectiveStewardshipScore: organization.objectiveStewardshipScore,
    stewardshipScore: organization.stewardshipScore,
    impactEvidenceScore: organization.impactEvidenceScore,
    impactEvidenceLevel: organization.impactEvidenceLevel,
    confidenceScore: organization.confidenceScore,
    confidenceBand: organization.confidenceBand,
    recommendation: organization.recommendation,
    rankingStatus: organization.rankingStatus,
    stewardshipScoreLabel: organization.stewardshipScoreLabel,
    legacyTier: organization.legacyTier,
    legacyEligible: organization.legacyEligible,
    rankingListLabel: organization.rankingListLabel,
    listObjectiveRank: organization.listObjectiveRank,
    rankingListSize: organization.rankingListSize,
    listRankLabel: formatListRankLabel(organization.listObjectiveRank, organization.rankingListSize),
    impactSourceTier: organization.impactSourceTier ?? "none",
    impactSourceTierLabel: impactSourceTierLabel(organization.impactSourceTier ?? "none"),
    quantifiedOutcomeCount: organization.quantifiedOutcomeCount ?? 0,
    giftSharePercent:
      totalAnnualGiving > 0 ? Math.round((organization.approximateAnnualDonation / totalAnnualGiving) * 1000) / 10 : 0,
    reviewFlag,
    duplicateMission: organization.duplicateMission ?? "",
    duplicateMissionGroup: organization.duplicateMissionGroup ?? "",
    duplicateMissionRole: organization.duplicateMissionRole ?? "",
  }
}

function formatGroupLabel(groupId: string): string {
  return groupId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function buildMissionOverlapGroups(
  organizations: Organization[],
  totalAnnualGiving: number,
): { missionOverlapGroups: MissionOverlapGroupSummary[]; ungroupedDuplicateFlags: PortfolioReviewOrganizationSummary[] } {
  const grouped = new Map<string, Organization[]>()

  for (const organization of organizations) {
    const groupId = organization.duplicateMissionGroup?.trim()
    if (!groupId) continue
    const group = grouped.get(groupId) ?? []
    group.push(organization)
    grouped.set(groupId, group)
  }

  const missionOverlapGroups = [...grouped.entries()]
    .filter(([, groupOrganizations]) => groupOrganizations.length >= 2)
    .map(([groupId, groupOrganizations]) => {
      const sortedOrganizations = [...groupOrganizations].sort(
        (left, right) => right.approximateAnnualDonation - left.approximateAnnualDonation,
      )
      const totalGroupGiving = sortedOrganizations.reduce(
        (sum, organization) => sum + organization.approximateAnnualDonation,
        0,
      )
      const hasPrimary = sortedOrganizations.some((organization) => organization.duplicateMissionRole === "primary")
      const primaryCount = sortedOrganizations.filter((organization) => organization.duplicateMissionRole === "primary").length

      let consolidationNote = "Pick one primary organization in this overlap group and keep others secondary or phasing-out."
      if (hasPrimary && primaryCount === 1) {
        consolidationNote = "This group has a primary organization marked. Consider reducing or pausing secondary/phasing-out peers."
      }
      if (hasPrimary && primaryCount > 1) {
        consolidationNote = "Multiple primaries are marked in this group — choose only one core organization."
      }

      return {
        groupId,
        groupLabel: formatGroupLabel(groupId),
        organizationCount: sortedOrganizations.length,
        totalAnnualGiving: Math.round(totalGroupGiving),
        hasPrimary,
        consolidationNote,
        organizations: sortedOrganizations.map((organization) => toReviewSummary(organization, totalAnnualGiving)),
      }
    })
    .sort((left, right) => right.totalAnnualGiving - left.totalAnnualGiving)

  const ungroupedDuplicateFlags = organizations
    .filter(
      (organization) =>
        organization.duplicateMission?.trim().toUpperCase() === "Y" && !organization.duplicateMissionGroup?.trim(),
    )
    .sort((left, right) => right.approximateAnnualDonation - left.approximateAnnualDonation)
    .map((organization) => toReviewSummary(organization, totalAnnualGiving))

  return { missionOverlapGroups, ungroupedDuplicateFlags }
}

function buildConsolidationSummary(organizations: Organization[]): PortfolioConsolidationSummary {
  const totalAnnualGiving = organizations.reduce((sum, organization) => sum + organization.approximateAnnualDonation, 0)
  const continueOrganizations = organizations.filter((organization) =>
    CONTINUE_RECOMMENDATIONS.includes(organization.recommendation),
  )
  const continueAnnualGiving = continueOrganizations.reduce(
    (sum, organization) => sum + organization.approximateAnnualDonation,
    0,
  )
  const continueRecommendationCount = continueOrganizations.length
  const excessContinueCount = Math.max(0, continueRecommendationCount - SUGGESTED_FOCUS_MAX)

  const headline =
    excessContinueCount > 0
      ? `${continueRecommendationCount} organizations are marked Keep or Priority Fund — more than the suggested ${SUGGESTED_FOCUS_MIN}–${SUGGESTED_FOCUS_MAX} core portfolio.`
      : `Portfolio size looks manageable with ${continueRecommendationCount} organizations marked Keep or Priority Fund.`

  const guidance =
    excessContinueCount > 0
      ? `Consider focusing annual giving on about ${SUGGESTED_FOCUS_MIN}–${SUGGESTED_FOCUS_MAX} strongest organizations. Use the top-by-dollars list and high-gift review flags below to decide what to keep, reduce, or pause.`
      : "Use list ranks within each mission area when comparing similar charities. Global rank is a portfolio overview, not a precise 1–79 verdict."

  return {
    totalOrganizations: organizations.length,
    totalAnnualGiving: Math.round(totalAnnualGiving),
    continueRecommendationCount,
    continueAnnualGiving: Math.round(continueAnnualGiving),
    continueGivingSharePercent:
      totalAnnualGiving > 0 ? Math.round((continueAnnualGiving / totalAnnualGiving) * 1000) / 10 : 0,
    priorityFundCount: organizations.filter((organization) => organization.recommendation === "Priority Fund").length,
    keepCount: organizations.filter((organization) => organization.recommendation === "Keep").length,
    reviewOrReduceCount: organizations.filter(
      (organization) => !CONTINUE_RECOMMENDATIONS.includes(organization.recommendation),
    ).length,
    legacyEligibleCount: organizations.filter((organization) => organization.legacyEligible).length,
    legacyCoreCount: organizations.filter((organization) => organization.legacyTier === "Legacy Core").length,
    suggestedFocusMin: SUGGESTED_FOCUS_MIN,
    suggestedFocusMax: SUGGESTED_FOCUS_MAX,
    excessContinueCount,
    headline,
    guidance,
  }
}

export function buildPortfolioReview(organizations: Organization[]): PortfolioReviewResponse {
  const totalAnnualGiving = organizations.reduce((sum, organization) => sum + organization.approximateAnnualDonation, 0)
  const toSummary = (organization: Organization) => toReviewSummary(organization, totalAnnualGiving)

  const topByAnnualGift = [...organizations]
    .sort((left, right) => {
      if (right.approximateAnnualDonation !== left.approximateAnnualDonation) {
        return right.approximateAnnualDonation - left.approximateAnnualDonation
      }
      return resolveObjectiveStewardshipScore(right) - resolveObjectiveStewardshipScore(left)
    })
    .slice(0, 20)
    .map(toSummary)

  const highGiftOutliers = organizations
    .filter(
      (organization) =>
        organization.approximateAnnualDonation >= HIGH_GIFT_OUTLIER_MIN &&
        !STRONG_RECOMMENDATIONS.includes(organization.recommendation),
    )
    .sort((left, right) => right.approximateAnnualDonation - left.approximateAnnualDonation)
    .map(toSummary)

  const researchGaps = organizations
    .filter(
      (organization) =>
        organization.rankingStatus === "Research Partial" ||
        organization.financialEfficiencyStatus === "unknown" ||
        organization.charityNavigatorRating === null,
    )
    .filter((organization) => organization.approximateAnnualDonation >= 75 || organization.legacyEligible)
    .sort((left, right) => right.approximateAnnualDonation - left.approximateAnnualDonation)
    .slice(0, 15)
    .map(toSummary)

  const suggestedCoreCandidates = organizations
    .filter(
      (organization) =>
        organization.recommendation === "Priority Fund" && organization.rankingStatus === "Research Complete",
    )
    .sort((left, right) => {
      if (right.approximateAnnualDonation !== left.approximateAnnualDonation) {
        return right.approximateAnnualDonation - left.approximateAnnualDonation
      }
      return resolveObjectiveStewardshipScore(right) - resolveObjectiveStewardshipScore(left)
    })
    .slice(0, SUGGESTED_FOCUS_MAX)
    .map(toSummary)

  const { missionOverlapGroups, ungroupedDuplicateFlags } = buildMissionOverlapGroups(organizations, totalAnnualGiving)

  return {
    consolidation: buildConsolidationSummary(organizations),
    topByAnnualGift,
    highGiftOutliers,
    researchGaps,
    suggestedCoreCandidates,
    missionOverlapGroups,
    ungroupedDuplicateFlags,
  }
}
