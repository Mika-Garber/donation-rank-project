import {
  LEGACY_RULES,
  PERSONALIZED_RANKING_RULES,
  RECOMMENDATION_THRESHOLDS,
  SOURCE_RELIABILITY_BY_TYPE,
  SOURCE_TYPE_KEYWORDS,
  SUGGESTED_DONATION_LEVEL_BY_RECOMMENDATION,
} from "../config/ranking-config.js"
import { RUBRIC_CATEGORY_MAX_POINTS } from "../config/ranking-rubric-config.js"
import type {
  CompactGivingRole,
  LegacyTier,
  Organization,
  RankingStatus,
  Recommendation,
  ScoreBreakdown,
  SourceMeta,
  SourceReliability,
  SourceType,
} from "../types/organization.js"
import { buildOrganizationRankingExplanation } from "./ranking-explanation-service.js"
import { getMissionBucket, getRankingListKey, getRankingListLabel } from "./ranking-list-service.js"
import {
  calculateRubricTotal,
  scoreAccountability,
  scoreFinancialEfficiency,
  scoreImpactEvidence,
  scoreLegalIdentity,
  scorePoliticalRisk,
  type LegalIdentityResult,
} from "./ranking-rubric.js"
import { getMissingCoreFields, getMissingFinancialFields, getMissingResearchFields, getWeightedResearchCompletenessPercent } from "./research-requirements.js"

const SERIOUS_RED_FLAG_KEYWORDS = ["fraud", "indict", "embezz", "sanction", "illegal", "lawsuit", "misuse", "criminal"]

function clampScore(value: number): number {
  return Math.max(0, Math.min(value, 100))
}

function getDonorConfidenceAdjustment(annualDonation: number, rankingStatus: RankingStatus): { points: number; reason: string } {
  if (annualDonation <= 0) {
    return {
      points: 0,
      reason: "No historical donor confidence signal applied because no prior annual donation is recorded.",
    }
  }

  let boost = 0.3
  if (annualDonation >= 1000) boost = 3
  else if (annualDonation >= 500) boost = 2.2
  else if (annualDonation >= 250) boost = 1.4
  else if (annualDonation >= 100) boost = 0.8

  if (PERSONALIZED_RANKING_RULES.halfBoostWhenUnverified && rankingStatus !== "Verified Ranking") {
    boost = boost / 2
  }

  boost = Math.min(boost, PERSONALIZED_RANKING_RULES.maxDonorConfidenceBoost)
  return {
    points: Math.round(boost * 10) / 10,
    reason: `Personalized rank includes a ${Math.round(boost * 10) / 10}-point donor-confidence boost from a prior annual donation of $${Math.round(annualDonation)}.`,
  }
}

function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return String(value)
}

function containsSeriousFlagText(text: string): boolean {
  const normalized = text.toLowerCase()
  return SERIOUS_RED_FLAG_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function getRedFlags(organization: Organization, legalIdentity: LegalIdentityResult): string[] {
  const flags: string[] = []
  const verified = toSafeString(organization.is501c3Verified).trim().toLowerCase()
  const notes = `${toSafeString(organization.notes)} ${toSafeString(organization.accountabilityNotes)} ${toSafeString(organization.politicalInvolvementNotes)}`
  if (legalIdentity.revokedOrUnverified) flags.push("501(c)(3) status appears revoked or is not verified.")
  if (legalIdentity.unclearIdentity) flags.push("Legal identity or EIN is unclear and needs verification before donating.")
  if (legalIdentity.identityConfusion) flags.push("Possible alias or identity confusion was noted in research.")
  if (verified && verified !== "y" && !legalIdentity.revokedOrUnverified) {
    flags.push("Nonprofit legal status is not verified.")
  }
  if (containsSeriousFlagText(notes)) flags.push("Serious legal or compliance concerns appear in available notes.")
  if (organization.researchStatus === "failed") flags.push("Automated research repeatedly failed and needs manual validation.")
  const alert = toSafeString(organization.charityNavigatorAlert).trim().toLowerCase()
  if (alert && !alert.includes("none") && !alert.includes("no alert")) {
    flags.push(`Charity Navigator alert: ${organization.charityNavigatorAlert}.`)
  }
  return flags
}

function hasSeriousRedFlag(redFlags: string[]): boolean {
  return redFlags.some((flag) => flag.toLowerCase().includes("legal") || flag.toLowerCase().includes("compliance"))
}

function determineRankingStatus(
  confidenceScore: number,
  redFlags: string[],
  hasAnyResearch: boolean,
  missingCoreFields: string[],
): RankingStatus {
  if (hasSeriousRedFlag(redFlags)) return "Do Not Fund / Red Flag"
  if (!hasAnyResearch && missingCoreFields.length > 0) return "Not Researched"
  if (confidenceScore < 50) return "Preliminary Only"
  if (confidenceScore < RECOMMENDATION_THRESHOLDS.verifiedMin) return "Partially Verified"
  return "Verified Ranking"
}

function getRecommendation(
  verifiedScore: number | null,
  preliminaryScore: number,
  confidenceScore: number,
  rankingStatus: RankingStatus,
  missingCoreFields: string[],
  politicalRiskPoints: number,
  politicalNotes: string,
  redFlags: string[],
  legalIdentity: LegalIdentityResult,
): Recommendation {
  if (hasSeriousRedFlag(redFlags)) return "Pause / Do Not Fund"
  if (legalIdentity.revokedOrUnverified) return "Pause / Do Not Fund"
  if (preliminaryScore < RECOMMENDATION_THRESHOLDS.reduceScoreMin) return "Pause / Do Not Fund"

  if (legalIdentity.unclearIdentity || missingCoreFields.length > 0) return "Review Before Donating"

  const politicalMax = RUBRIC_CATEGORY_MAX_POINTS.politicalRisk
  const politicalPercent = (politicalRiskPoints / politicalMax) * 100
  if (politicalPercent < 40 && politicalNotes.includes("high")) return "Pause / Do Not Fund"
  if (politicalPercent < 60 || politicalNotes.includes("unclear")) return "Review Before Donating"

  if (rankingStatus === "Not Researched" || rankingStatus === "Preliminary Only") {
    return preliminaryScore >= 70 ? "Small Test Donation" : "Review Before Donating"
  }

  if (rankingStatus === "Partially Verified") {
    if (confidenceScore < 60) return "Review Before Donating"
    if (preliminaryScore >= 70) return "Keep Small Until Verified"
    return "Small Test Donation"
  }

  if (verifiedScore === null) return "Review Before Donating"
  if (verifiedScore >= 85 && confidenceScore >= 80) return "Priority Fund"
  if (verifiedScore >= 70 && confidenceScore >= 70) return "Keep"
  if (verifiedScore >= 55 || confidenceScore < 70) return "Review Before Donating"
  return "Reduce"
}

function getStrongestNextResearchStep(
  missingCoreFields: string[],
  missingFinancialFields: string[],
  organization: Organization,
  redFlags: string[],
): string {
  if (missingCoreFields.includes("ein")) return "Find EIN"
  if (missingCoreFields.includes("is501c3Verified")) return "Verify 501(c)(3)"
  if (missingFinancialFields.length === 3) return "Find Form 990"
  if (organization.charityNavigatorRating === null) return "Check Charity Navigator"
  if (!toSafeString(organization.impactEvidenceNotes).trim()) return "Check annual report or impact report"
  if (!toSafeString(organization.politicalInvolvementNotes).trim()) return "Check political/lobbying/advocacy involvement"
  if (redFlags.length > 0) return "Check red flags/scandals"
  return "Check ProPublica"
}

function getDonationAmountAssessment(
  organization: Organization,
  verifiedScore: number | null,
  preliminaryScore: number,
  confidenceScore: number,
  recommendation: Recommendation,
  hasFinancials: boolean,
): string {
  const scoreToUse = verifiedScore ?? preliminaryScore
  if (recommendation === "Pause / Do Not Fund") return "Low confidence or risk issues suggest reducing or pausing this gift."
  if (!hasFinancials) return "Missing financial/accountability data — research first or keep as a small test donation."
  if (scoreToUse >= 85 && confidenceScore >= 80) return "High score and high confidence suggest current donation may be justified."
  if (scoreToUse >= 80 && confidenceScore < 70) return "High potential but low confidence — keep small until verified."
  if (scoreToUse < 55 && organization.approximateAnnualDonation >= 200) return "Low score with meaningful donation — reduce or pause."
  return "Current gift size is acceptable with periodic review."
}

function getSuggestedDonationAction(recommendation: Recommendation, rankingStatus: RankingStatus): string {
  if (rankingStatus === "Preliminary Only" || rankingStatus === "Not Researched") {
    return "Preliminary score only — not enough verified data for final ranking."
  }
  if (recommendation === "Priority Fund") return "Deserves continued support."
  if (recommendation === "Keep") return "Good fit for recurring giving."
  if (recommendation === "Keep Small Until Verified") return "Keep small until verified."
  if (recommendation === "Small Test Donation") return "Promising score, but not fully researched."
  if (recommendation === "Review Before Donating") return "Good candidate, but needs accountability check."
  if (recommendation === "Reduce") return "Reduce because accountability or evidence is weaker."
  return "Pause due to low score or serious risk."
}

function getLegacyDecision(
  verifiedScore: number | null,
  confidenceScore: number,
  missingCoreFields: string[],
  hasFinancials: boolean,
  impactEvidencePoints: number,
  politicalRiskPoints: number,
  redFlags: string[],
  legalIdentity: LegalIdentityResult,
): { legacyEligible: boolean; legacyTier: LegacyTier; legacyRationale: string } {
  const legalVerified = missingCoreFields.length === 0 && !legalIdentity.unclearIdentity && !legalIdentity.revokedOrUnverified
  const impactStrong = impactEvidencePoints >= 21
  const politicalPercent = (politicalRiskPoints / RUBRIC_CATEGORY_MAX_POINTS.politicalRisk) * 100
  const strictEligible =
    verifiedScore !== null &&
    verifiedScore >= LEGACY_RULES.scoreMin &&
    confidenceScore >= LEGACY_RULES.confidenceMin &&
    legalVerified &&
    hasFinancials &&
    impactStrong &&
    politicalPercent >= LEGACY_RULES.politicalRiskMin &&
    !hasSeriousRedFlag(redFlags)

  if (strictEligible && verifiedScore >= 90) {
    return { legacyEligible: true, legacyTier: "Legacy Core", legacyRationale: "Verified, high-confidence, and suitable for legacy giving." }
  }
  if (strictEligible) {
    return { legacyEligible: true, legacyTier: "Legacy Backup", legacyRationale: "Eligible for legacy giving with slightly lower strength than core candidates." }
  }
  if (verifiedScore !== null && verifiedScore >= 75) {
    return {
      legacyEligible: false,
      legacyTier: "Needs Legal/Financial Review",
      legacyRationale: "Not legacy eligible yet — needs more research.",
    }
  }
  return { legacyEligible: false, legacyTier: "Not Legacy Eligible", legacyRationale: "Not legacy eligible yet — needs more research." }
}

function getCompactGivingRole(recommendation: Recommendation, rankingStatus: RankingStatus): CompactGivingRole {
  if (recommendation === "Priority Fund" && rankingStatus === "Verified Ranking") return "Core Charity"
  if (recommendation === "Keep" && rankingStatus === "Verified Ranking") return "Secondary Charity"
  if (recommendation === "Keep Small Until Verified" || recommendation === "Small Test Donation") return "Watchlist"
  if (recommendation === "Pause / Do Not Fund" || recommendation === "Reduce") return "Pause"
  return "Small Local Support"
}

function getSourceTypeFromName(sourceName: string): SourceType {
  const normalized = sourceName.toLowerCase()
  for (const [sourceType, keywords] of Object.entries(SOURCE_TYPE_KEYWORDS) as Array<[SourceType, string[]]>) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return sourceType
  }
  return "Unknown"
}

function normalizeSourceMeta(sourceMeta: Record<string, SourceMeta>): Record<string, SourceMeta> {
  const normalizedEntries = Object.entries(sourceMeta ?? {}).map(([field, source]) => {
    const sourceType = source.sourceType ?? getSourceTypeFromName(source.sourceName)
    const reliability: SourceReliability = source.reliability ?? SOURCE_RELIABILITY_BY_TYPE[sourceType]
    return [field, { ...source, sourceType, reliability }]
  })
  return Object.fromEntries(normalizedEntries)
}

export function calculateScoreBreakdown(organization: Organization): ScoreBreakdown {
  const missionBucket = getMissionBucket(organization.category, organization.subcategory)
  const rankingListKey = getRankingListKey(missionBucket, organization.subcategory)
  const rankingListLabel = getRankingListLabel(missionBucket, organization.subcategory)
  const legalIdentity = scoreLegalIdentity(organization)
  const accountability = scoreAccountability(organization)
  const impact = scoreImpactEvidence(organization)
  const financial = scoreFinancialEfficiency(organization)
  const political = scorePoliticalRisk(organization, missionBucket)
  const governanceScore = legalIdentity.points
  const accountabilityScore = accountability.points
  const impactEvidenceScore = impact.points
  const politicalRiskScore = political.points
  const missingFields = getMissingResearchFields(organization)
  const missingCoreFields = getMissingCoreFields(organization)
  const missingFinancialFields = getMissingFinancialFields(organization)
  const redFlags = getRedFlags(organization, legalIdentity)
  const normalizedSourceMeta = normalizeSourceMeta(organization.sourceMeta ?? {})

  const rubricTotal = calculateRubricTotal(legalIdentity, accountability, impact, financial, political)
  const preliminaryScore = clampScore(rubricTotal.preliminaryScore)

  let confidenceScore = getWeightedResearchCompletenessPercent(organization)
  if (organization.researchStatus === "complete") confidenceScore += 10
  if (organization.researchStatus === "partial") confidenceScore += 4
  if (organization.researchStatus === "failed") confidenceScore -= 12
  if (financial.status === "unknown") confidenceScore -= 8
  if (financial.staleData) confidenceScore -= 4
  if (legalIdentity.unclearIdentity) confidenceScore -= 6
  if (!toSafeString(organization.politicalInvolvementNotes).trim()) confidenceScore -= 4
  if (!toSafeString(organization.impactEvidenceNotes).trim()) confidenceScore -= 4
  confidenceScore = clampScore(confidenceScore)

  const hasAnyResearch = Object.keys(normalizedSourceMeta).length > 0 || organization.researchAttempts > 0
  const rankingStatus = determineRankingStatus(confidenceScore, redFlags, hasAnyResearch, missingCoreFields)
  const verifiedDonationWorthinessScore =
    rankingStatus === "Verified Ranking" && confidenceScore >= RECOMMENDATION_THRESHOLDS.verifiedMin
      ? Math.round(preliminaryScore * 10) / 10
      : null
  const objectiveDonationWorthinessScore = verifiedDonationWorthinessScore ?? Math.round(preliminaryScore * 10) / 10
  const donorConfidence = getDonorConfidenceAdjustment(organization.approximateAnnualDonation, rankingStatus)
  const personalizedDonationWorthinessScore = clampScore(objectiveDonationWorthinessScore + donorConfidence.points)
  const recommendation = getRecommendation(
    verifiedDonationWorthinessScore,
    preliminaryScore,
    confidenceScore,
    rankingStatus,
    missingCoreFields,
    politicalRiskScore,
    toSafeString(organization.politicalInvolvementNotes).toLowerCase(),
    redFlags,
    legalIdentity,
  )
  const strongestNextResearchStep = getStrongestNextResearchStep(
    missingCoreFields,
    missingFinancialFields,
    organization,
    redFlags,
  )
  const criticalMissingFields = [
    ...missingCoreFields,
    ...(financial.status === "unknown" ? ["programPercent", "fundraisingPercent", "adminPercent"] : []),
    ...(!toSafeString(organization.politicalInvolvementNotes).trim() ? ["politicalInvolvementNotes"] : []),
    ...(!toSafeString(organization.impactEvidenceNotes).trim() ? ["impactEvidenceNotes"] : []),
  ]
  const donationAmountAssessment = getDonationAmountAssessment(
    organization,
    verifiedDonationWorthinessScore,
    preliminaryScore,
    confidenceScore,
    recommendation,
    financial.status === "known",
  )
  const suggestedDonationAction = getSuggestedDonationAction(recommendation, rankingStatus)
  const suggestedDonationLevel = SUGGESTED_DONATION_LEVEL_BY_RECOMMENDATION[recommendation]
  const legacyDecision = getLegacyDecision(
    verifiedDonationWorthinessScore,
    confidenceScore,
    missingCoreFields,
    financial.status === "known",
    impactEvidenceScore,
    politicalRiskScore,
    redFlags,
    legalIdentity,
  )
  const compactGivingRole = getCompactGivingRole(recommendation, rankingStatus)
  const reasons: string[] = []
  if (rankingStatus !== "Verified Ranking") reasons.push("Preliminary score only — not enough verified data for final ranking.")
  if (financial.warning) reasons.push(financial.warning)
  if (redFlags.length > 0) reasons.push("Serious concerns were identified and require manual review.")
  if (!toSafeString(organization.impactEvidenceNotes).trim()) reasons.push("Impact evidence is limited.")
  if (donorConfidence.points > 0) reasons.push(donorConfidence.reason)

  return {
    preliminaryScore: Math.round(preliminaryScore * 10) / 10,
    verifiedDonationWorthinessScore,
    objectiveDonationWorthinessScore,
    personalizedDonationWorthinessScore: Math.round(personalizedDonationWorthinessScore * 10) / 10,
    donorConfidenceAdjustment: donorConfidence.points,
    donorConfidenceReason: donorConfidence.reason,
    rankShiftReason: "Rank shift is based on personalized donor-confidence adjustment versus objective rank.",
    donationWorthinessScore: objectiveDonationWorthinessScore,
    rankingStatus,
    impactEvidenceScore: Math.round(impactEvidenceScore * 10) / 10,
    accountabilityScore: Math.round(accountabilityScore * 10) / 10,
    financialEfficiencyScore: financial.status === "unknown" ? null : Math.round(financial.points * 10) / 10,
    financialEfficiencyStatus: financial.status,
    governanceScore: Math.round(governanceScore * 10) / 10,
    politicalRiskScore: Math.round(politicalRiskScore * 10) / 10,
    confidenceScore: Math.round(confidenceScore * 10) / 10,
    recommendation,
    donationAmountAssessment,
    suggestedDonationAction,
    suggestedDonationLevel,
    legacyEligible: legacyDecision.legacyEligible,
    legacyTier: legacyDecision.legacyTier,
    legacyRationale: legacyDecision.legacyRationale,
    missionBucket,
    rankingListKey,
    rankingListLabel,
    compactGivingRole,
    politicalInvolvementNotes: toSafeString(organization.politicalInvolvementNotes).trim(),
    impactEvidenceNotes: toSafeString(organization.impactEvidenceNotes).trim(),
    accountabilityNotes: toSafeString(organization.accountabilityNotes).trim(),
    redFlags,
    nextAction: suggestedDonationAction,
    criticalMissingFields: Array.from(new Set(criticalMissingFields)),
    strongestNextResearchStep,
    reasons,
    missingFields,
  }
}

export function getScoreSpreadCheck(organizations: Organization[]): {
  clustered: boolean
  lowerBound: number
  upperBound: number
  clusteredCount: number
  clusteredPercent: number
  warning: string | null
} {
  const scores = organizations
    .map((organization) => organization.verifiedDonationWorthinessScore ?? organization.preliminaryScore ?? 0)
    .filter((score) => score >= 0)
  const lowerBound = 70
  const upperBound = 77
  const clusteredCount = scores.filter((score) => score >= lowerBound && score <= upperBound).length
  const clusteredPercent = scores.length ? Math.round((clusteredCount / scores.length) * 1000) / 10 : 0
  const clustered = clusteredPercent >= 45
  return {
    clustered,
    lowerBound,
    upperBound,
    clusteredCount,
    clusteredPercent,
    warning: clustered
      ? "Ranking is not yet differentiated enough. More research is needed on financial efficiency, impact, accountability, and political involvement."
      : null,
  }
}

export function rankOrganizations(organizations: Organization[]): Organization[] {
  const ranked = organizations.map((organization) => {
    const scoreBreakdown = calculateScoreBreakdown(organization)
    return {
      ...organization,
      sourceMeta: normalizeSourceMeta(organization.sourceMeta ?? {}),
      rankingStatus: scoreBreakdown.rankingStatus,
      preliminaryScore: scoreBreakdown.preliminaryScore,
      verifiedDonationWorthinessScore: scoreBreakdown.verifiedDonationWorthinessScore,
      objectiveDonationWorthinessScore: scoreBreakdown.objectiveDonationWorthinessScore,
      personalizedDonationWorthinessScore: scoreBreakdown.personalizedDonationWorthinessScore,
      donorConfidenceAdjustment: scoreBreakdown.donorConfidenceAdjustment,
      donorConfidenceReason: scoreBreakdown.donorConfidenceReason,
      donationWorthinessScore: scoreBreakdown.objectiveDonationWorthinessScore,
      impactEvidenceScore: scoreBreakdown.impactEvidenceScore,
      accountabilityScore: scoreBreakdown.accountabilityScore,
      financialEfficiencyScore: scoreBreakdown.financialEfficiencyScore,
      financialEfficiencyStatus: scoreBreakdown.financialEfficiencyStatus,
      governanceScore: scoreBreakdown.governanceScore,
      politicalRiskScore: scoreBreakdown.politicalRiskScore,
      confidenceScore: scoreBreakdown.confidenceScore,
      recommendation: scoreBreakdown.recommendation,
      donationAmountAssessment: scoreBreakdown.donationAmountAssessment,
      suggestedDonationAction: scoreBreakdown.suggestedDonationAction,
      suggestedDonationLevel: scoreBreakdown.suggestedDonationLevel,
      legacyEligible: scoreBreakdown.legacyEligible,
      legacyTier: scoreBreakdown.legacyTier,
      legacyRationale: scoreBreakdown.legacyRationale,
      missionBucket: scoreBreakdown.missionBucket,
      rankingListKey: scoreBreakdown.rankingListKey,
      rankingListLabel: scoreBreakdown.rankingListLabel,
      compactGivingRole: scoreBreakdown.compactGivingRole,
      politicalInvolvementNotes: scoreBreakdown.politicalInvolvementNotes,
      impactEvidenceNotes: scoreBreakdown.impactEvidenceNotes,
      accountabilityNotes: scoreBreakdown.accountabilityNotes,
      redFlags: scoreBreakdown.redFlags,
      nextAction: scoreBreakdown.nextAction,
      criticalMissingFields: scoreBreakdown.criticalMissingFields,
      strongestNextResearchStep: scoreBreakdown.strongestNextResearchStep,
      objectiveRank: 0,
      personalizedRank: 0,
      globalObjectiveRank: 0,
      globalPersonalizedRank: 0,
      listObjectiveRank: 0,
      listPersonalizedRank: 0,
      rankingListSize: 0,
      rankShift: 0,
      rankShiftReason: scoreBreakdown.rankShiftReason,
      scoreBreakdown,
    }
  })

  const globalObjectiveRankById = buildRankMap(ranked, "objective")
  const globalPersonalizedRankById = buildRankMap(ranked, "personalized")

  const listGroups = new Map<string, typeof ranked>()
  for (const organization of ranked) {
    const listKey = organization.rankingListKey
    const group = listGroups.get(listKey) ?? []
    group.push(organization)
    listGroups.set(listKey, group)
  }

  const listObjectiveRankById = new Map<string, number>()
  const listPersonalizedRankById = new Map<string, number>()
  const listSizeById = new Map<string, number>()

  for (const group of listGroups.values()) {
    const listObjectiveRanks = buildRankMap(group, "objective")
    const listPersonalizedRanks = buildRankMap(group, "personalized")
    for (const organization of group) {
      listObjectiveRankById.set(organization.id, listObjectiveRanks.get(organization.id) ?? 0)
      listPersonalizedRankById.set(organization.id, listPersonalizedRanks.get(organization.id) ?? 0)
      listSizeById.set(organization.id, group.length)
    }
  }

  const totalOrganizations = ranked.length

  return ranked.map((organization) => {
    const globalObjectiveRank = globalObjectiveRankById.get(organization.id) ?? 0
    const globalPersonalizedRank = globalPersonalizedRankById.get(organization.id) ?? 0
    const listObjectiveRank = listObjectiveRankById.get(organization.id) ?? 0
    const listPersonalizedRank = listPersonalizedRankById.get(organization.id) ?? 0
    const rankingListSize = listSizeById.get(organization.id) ?? 0
    const objectiveRank = listObjectiveRank
    const personalizedRank = listPersonalizedRank
    const rankShift = listObjectiveRank - listPersonalizedRank
    const rankShiftText =
      rankShift > 0
        ? `Moved up ${rankShift} places in personalized list rank due to prior donor confidence signal.`
        : rankShift < 0
          ? `Moved down ${Math.abs(rankShift)} places in personalized list rank after comparing against stronger peers in ${organization.rankingListLabel}.`
          : "No rank movement between objective and personalized ordering within this list."

    const updatedScoreBreakdown = {
      ...organization.scoreBreakdown,
      objectiveRank,
      personalizedRank,
      globalObjectiveRank,
      globalPersonalizedRank,
      listObjectiveRank,
      listPersonalizedRank,
      rankingListSize,
      rankShift,
      rankShiftReason: rankShiftText,
    }

    const rankedOrganization = {
      ...organization,
      objectiveRank,
      personalizedRank,
      globalObjectiveRank,
      globalPersonalizedRank,
      listObjectiveRank,
      listPersonalizedRank,
      rankingListSize,
      rankShift,
      rankShiftReason: rankShiftText,
      scoreBreakdown: updatedScoreBreakdown,
    }

    return {
      ...rankedOrganization,
      scoreBreakdown: {
        ...updatedScoreBreakdown,
        rankingExplanation: buildOrganizationRankingExplanation(rankedOrganization, totalOrganizations),
      },
    }
  })
}

function buildRankMap(
  organizations: Organization[],
  mode: "objective" | "personalized",
): Map<string, number> {
  const sorted = [...organizations].sort((left, right) => {
    if (mode === "objective") {
      if (right.objectiveDonationWorthinessScore !== left.objectiveDonationWorthinessScore) {
        return right.objectiveDonationWorthinessScore - left.objectiveDonationWorthinessScore
      }
      if (right.confidenceScore !== left.confidenceScore) return right.confidenceScore - left.confidenceScore
      return left.organizationName.localeCompare(right.organizationName)
    }

    if (right.personalizedDonationWorthinessScore !== left.personalizedDonationWorthinessScore) {
      return right.personalizedDonationWorthinessScore - left.personalizedDonationWorthinessScore
    }
    if (right.objectiveDonationWorthinessScore !== left.objectiveDonationWorthinessScore) {
      return right.objectiveDonationWorthinessScore - left.objectiveDonationWorthinessScore
    }
    if (right.confidenceScore !== left.confidenceScore) return right.confidenceScore - left.confidenceScore
    return left.organizationName.localeCompare(right.organizationName)
  })

  return new Map(sorted.map((organization, index) => [organization.id, index + 1]))
}
