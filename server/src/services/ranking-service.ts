import {
  CONFIDENCE_BAND_THRESHOLDS,
  LEGACY_RULES,
  PERSONALIZED_RANKING_RULES,
  RANKING_MODEL_VERSION,
  RANKING_VERIFICATION,
  RECOMMENDATION_THRESHOLDS,
  SCORE_BAND_THRESHOLDS,
  SOURCE_RELIABILITY_BY_TYPE,
  SOURCE_TYPE_KEYWORDS,
  SUGGESTED_DONATION_LEVEL_BY_RECOMMENDATION,
} from "../config/ranking-config.js"
import type {
  AdvocacyReviewStatus,
  CompactGivingRole,
  ConfidenceBand,
  ImpactEvidenceLevel,
  LegalVerificationStatus,
  LegacyTier,
  Organization,
  RankingStatus,
  Recommendation,
  ScoreBand,
  ScoreBreakdown,
  SourceMeta,
  SourceReliability,
  SourceType,
} from "../types/organization.js"
import { classifyOrganizationSize, type OrganizationSize } from "./organization-size-service.js"
import {
  getImpactEvidenceLevel,
  impactEvidenceLevelMeetsBasic,
  syncImpactMetadata,
} from "./impact-metadata-service.js"
import { buildOrganizationRankingExplanation } from "./ranking-explanation-service.js"
import {
  advocacyStatusBlocksLegacy,
  advocacyStatusCapsRecommendation,
  advocacyStatusForcesPause,
  advocacyStatusNeedsPoliticalNotes,
  deriveAdvocacyReviewStatus,
} from "./advocacy-review-service.js"
import { getMissionBucket, getRankingListKey, getRankingListLabel } from "./ranking-list-service.js"
import {
  calculateStewardshipTotal,
  deriveLegalVerificationStatus,
  scoreAccountability,
  scoreFinancialEfficiency,
  scoreImpactEvidence,
  scoreLegalIdentity,
  scoreMissionFit,
  scorePoliticalRisk,
  scoreStewardshipGovernance,
  type LegalIdentityResult,
} from "./ranking-rubric.js"
import {
  calculateConfidenceScore,
  getCategoryVerificationFlags,
  getMissingCoreFields,
  getMissingFinancialFields,
  getMissingResearchFields,
} from "./research-requirements.js"
import {
  resolveObjectiveStewardshipScore,
  resolvePreliminaryStewardshipScore,
  resolveVerifiedStewardshipScore,
} from "./stewardship-score-fields.js"

const SERIOUS_RED_FLAG_KEYWORDS = ["fraud", "indict", "embezz", "sanction", "illegal", "lawsuit", "misuse", "criminal"]

function clampScore(value: number): number {
  return Math.max(0, Math.min(value, 100))
}

function getDonorConfidenceAdjustment(
  annualDonation: number,
  rankingStatus: RankingStatus,
  legalVerificationStatus: LegalVerificationStatus,
): { points: number; reason: string } {
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

  if (PERSONALIZED_RANKING_RULES.halfBoostWhenUnverified) {
    if (rankingStatus !== "Research Complete" || legalVerificationStatus !== "Verified") {
      boost = boost / 2
    }
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
  if (organization.charityNavigatorRating !== null && organization.charityNavigatorRating <= 2) {
    flags.push(`Charity Navigator rating is ${organization.charityNavigatorRating} stars — watchdog review recommended.`)
  }
  if (organization.charityWatchGrade) {
    const normalizedGrade = organization.charityWatchGrade.trim().toUpperCase()
    if (normalizedGrade === "D" || normalizedGrade === "F") {
      flags.push(`CharityWatch grade ${organization.charityWatchGrade} is poor — watchdog review recommended.`)
    }
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
  hasFinancials: boolean,
  legalVerificationStatus: LegalVerificationStatus,
): RankingStatus {
  if (hasSeriousRedFlag(redFlags)) return "Do Not Fund / Red Flag"
  if (legalVerificationStatus === "Failed Verification") return "Do Not Fund / Red Flag"
  if (!hasAnyResearch && missingCoreFields.length > 0) return "Not Researched"
  if (missingCoreFields.length > 0) return "Preliminary"
  if (!hasFinancials) return "Research Partial"
  if (legalVerificationStatus === "Needs Review" || legalVerificationStatus === "Insufficient Data") {
    return "Research Partial"
  }
  if (confidenceScore < 50) return "Preliminary"
  if (confidenceScore < RANKING_VERIFICATION.verifiedConfidenceMin) return "Research Partial"
  return "Research Complete"
}

function getConfidenceBand(confidenceScore: number): ConfidenceBand {
  if (confidenceScore >= CONFIDENCE_BAND_THRESHOLDS.high) return "High"
  if (confidenceScore >= CONFIDENCE_BAND_THRESHOLDS.medium) return "Medium"
  return "Low"
}

function getScoreBand(score: number, rankingStatus: RankingStatus, confidenceScore: number): ScoreBand {
  if (rankingStatus === "Not Researched" || rankingStatus === "Preliminary" || confidenceScore < 60) {
    return "Insufficient Data"
  }
  if (score >= SCORE_BAND_THRESHOLDS.exceptional) return "Exceptional"
  if (score >= SCORE_BAND_THRESHOLDS.strong) return "Strong"
  if (score >= SCORE_BAND_THRESHOLDS.adequate) return "Adequate"
  return "Weak"
}

function getStewardshipScoreLabel(
  _rankingStatus: RankingStatus,
  score: number,
  financialIncluded: boolean,
  _legalVerificationStatus: LegalVerificationStatus,
): string {
  const financialNote = financialIncluded ? "" : "*"
  return `Stewardship ${score}${financialNote}`
}

function getWeakestCategoryPercent(organization: Organization): number {
  const breakdown = organization.scoreBreakdown
  if (!breakdown) return 0

  const categoryPercents = [breakdown.governanceScore, breakdown.accountabilityScore, breakdown.missionFitScore]

  if (breakdown.financialEfficiencyStatus === "known" && breakdown.financialEfficiencyScore !== null) {
    categoryPercents.push(breakdown.financialEfficiencyScore)
  }

  return Math.min(...categoryPercents)
}

function getRecommendation(
  verifiedStewardshipScore: number | null,
  preliminaryStewardshipScore: number,
  confidenceScore: number,
  rankingStatus: RankingStatus,
  missingCoreFields: string[],
  redFlags: string[],
  legalIdentity: LegalIdentityResult,
  legalVerificationStatus: LegalVerificationStatus,
  accountabilityScore: number,
  organizationSize: OrganizationSize,
  impactEvidenceLevel: ImpactEvidenceLevel,
  watchdogReviewRequired: boolean,
  advocacyReviewStatus: AdvocacyReviewStatus,
  advocacyHaystack: string,
  financialIncluded: boolean,
): Recommendation {
  if (hasSeriousRedFlag(redFlags)) return "Pause / Do Not Fund"
  if (legalIdentity.revokedOrUnverified || legalVerificationStatus === "Failed Verification") {
    return "Pause / Do Not Fund"
  }

  if (advocacyStatusForcesPause(advocacyReviewStatus, advocacyHaystack)) return "Pause / Do Not Fund"

  if (legalVerificationStatus === "Insufficient Data") return "Review Before Donating"

  if (confidenceScore < RECOMMENDATION_THRESHOLDS.reviewConfidenceMax) return "Review Before Donating"

  if (accountabilityScore < RECOMMENDATION_THRESHOLDS.accountabilityMinForReduce) return "Reduce"

  const scoreForReduceCheck = verifiedStewardshipScore ?? preliminaryStewardshipScore
  if (scoreForReduceCheck < RECOMMENDATION_THRESHOLDS.stewardshipMinForReduce) return "Reduce"

  if (legalIdentity.unclearIdentity || missingCoreFields.length > 0 || legalVerificationStatus === "Needs Review") {
    return "Review Before Donating"
  }

  if (advocacyStatusCapsRecommendation(advocacyReviewStatus)) return "Review Before Donating"

  if (rankingStatus === "Not Researched" || rankingStatus === "Preliminary") {
    return preliminaryStewardshipScore >= 70 ? "Small Test Donation" : "Review Before Donating"
  }

  if (
    rankingStatus === "Research Partial" ||
    !financialIncluded ||
    confidenceScore < RECOMMENDATION_THRESHOLDS.keepSmallConfidenceMax
  ) {
    if (confidenceScore < 60) return "Review Before Donating"
    if (preliminaryStewardshipScore >= RECOMMENDATION_THRESHOLDS.keepScoreMin) return "Keep Small Until Research Complete"
    return "Small Test Donation"
  }

  if (verifiedStewardshipScore === null) return "Review Before Donating"

  const scoreToUse = verifiedStewardshipScore

  if (watchdogReviewRequired) {
    if (scoreToUse >= RECOMMENDATION_THRESHOLDS.reviewScoreMin) return "Review Before Donating"
    return "Reduce"
  }

  let recommendation: Recommendation = "Review Before Donating"

  if (
    rankingStatus === "Research Complete" &&
    legalVerificationStatus === "Verified" &&
    scoreToUse >= RECOMMENDATION_THRESHOLDS.priorityFundScoreMin &&
    confidenceScore >= RECOMMENDATION_THRESHOLDS.priorityFundConfidenceMin &&
    accountabilityScore >= RECOMMENDATION_THRESHOLDS.accountabilityMinForKeep &&
    impactEvidenceLevelMeetsBasic(impactEvidenceLevel)
  ) {
    recommendation = "Priority Fund"
  } else if (
    rankingStatus === "Research Complete" &&
    legalVerificationStatus === "Verified" &&
    scoreToUse >= RECOMMENDATION_THRESHOLDS.keepScoreMin &&
    confidenceScore >= RECOMMENDATION_THRESHOLDS.keepConfidenceMin &&
    accountabilityScore >= RECOMMENDATION_THRESHOLDS.accountabilityMinForKeep
  ) {
    recommendation = "Keep"
  } else if (scoreToUse >= RECOMMENDATION_THRESHOLDS.reviewScoreMin) {
    recommendation = "Review Before Donating"
  } else {
    recommendation = "Reduce"
  }

  if (organizationSize === "micro") {
    if (recommendation === "Priority Fund" || recommendation === "Keep") return "Keep Small Until Research Complete"
    if (recommendation === "Review Before Donating" && preliminaryStewardshipScore >= 65) return "Small Test Donation"
  }

  if (organizationSize === "small" && recommendation === "Priority Fund") {
    return "Keep"
  }

  return recommendation
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
  preliminaryStewardshipScore: number,
  confidenceScore: number,
  recommendation: Recommendation,
  hasFinancials: boolean,
): string {
  const scoreToUse = verifiedScore ?? preliminaryStewardshipScore
  if (recommendation === "Pause / Do Not Fund") return "Low confidence or risk issues suggest reducing or pausing this gift."
  if (!hasFinancials) return "Missing financial/accountability data — research first or keep as a small test donation."
  if (scoreToUse >= 85 && confidenceScore >= 80) return "High score and high confidence suggest current donation may be justified."
  if (scoreToUse >= 80 && confidenceScore < 70) return "High potential but low confidence — keep small until verified."
  if (scoreToUse < 55 && organization.approximateAnnualDonation >= 200) return "Low score with meaningful donation — reduce or pause."
  return "Current gift size is acceptable with periodic review."
}

function getSuggestedDonationAction(recommendation: Recommendation, rankingStatus: RankingStatus): string {
  if (rankingStatus === "Preliminary" || rankingStatus === "Not Researched") {
    return "Preliminary research only — finish core fields before treating list rank as final."
  }
  if (recommendation === "Priority Fund") return "Deserves continued support."
  if (recommendation === "Keep") return "Good fit for recurring giving."
  if (recommendation === "Keep Small Until Research Complete") return "Keep small until research is complete."
  if (recommendation === "Small Test Donation") return "Promising stewardship, but research is still incomplete."
  if (recommendation === "Review Before Donating") return "Check review flags and impact evidence before your next gift."
  if (recommendation === "Reduce") return "Reduce because stewardship, watchdog, or evidence signals are weaker."
  return "Pause due to low stewardship score or serious risk."
}

function getLegacyDecision(
  verifiedStewardshipScore: number | null,
  confidenceScore: number,
  missingCoreFields: string[],
  hasFinancials: boolean,
  impactEvidenceLevel: ImpactEvidenceLevel,
  accountabilityScore: number,
  redFlags: string[],
  legalIdentity: LegalIdentityResult,
  legalVerificationStatus: LegalVerificationStatus,
  organizationSize: OrganizationSize,
  advocacyReviewStatus: AdvocacyReviewStatus,
): { legacyEligible: boolean; legacyTier: LegacyTier; legacyRationale: string; legacyExclusionReason: string | null } {
  const legalVerified =
    missingCoreFields.length === 0 &&
    !legalIdentity.unclearIdentity &&
    !legalIdentity.revokedOrUnverified &&
    legalVerificationStatus === "Verified"
  const impactStrong = impactEvidenceLevelMeetsBasic(impactEvidenceLevel)
  const accountabilityStrong = accountabilityScore >= LEGACY_RULES.accountabilityMin
  const failures: string[] = []

  if (verifiedStewardshipScore === null) failures.push("No verified stewardship score yet")
  if (verifiedStewardshipScore !== null && verifiedStewardshipScore < LEGACY_RULES.stewardshipScoreMin) {
    failures.push(`Verified stewardship ${verifiedStewardshipScore} — needs ${LEGACY_RULES.stewardshipScoreMin}+`)
  }
  if (confidenceScore < LEGACY_RULES.confidenceMin) {
    failures.push(`Confidence ${confidenceScore}% — needs ${LEGACY_RULES.confidenceMin}%+`)
  }
  if (!legalVerified) failures.push("Legal identity or 501(c)(3) not fully verified")
  if (!hasFinancials) failures.push("Financial ratios not verified")
  if (!impactStrong) failures.push(`Impact evidence level "${impactEvidenceLevel}" — needs Basic or Strong`)
  if (!accountabilityStrong) failures.push(`Accountability ${accountabilityScore}/100 — needs ${LEGACY_RULES.accountabilityMin}+`)
  if (advocacyStatusBlocksLegacy(advocacyReviewStatus)) failures.push("Advocacy review needs donor comfort confirmation")
  if (hasSeriousRedFlag(redFlags)) failures.push("Serious red flags require manual review")

  const strictEligible =
    verifiedStewardshipScore !== null &&
    verifiedStewardshipScore >= LEGACY_RULES.stewardshipScoreMin &&
    confidenceScore >= LEGACY_RULES.confidenceMin &&
    legalVerified &&
    hasFinancials &&
    impactStrong &&
    accountabilityStrong &&
    !advocacyStatusBlocksLegacy(advocacyReviewStatus) &&
    !hasSeriousRedFlag(redFlags)

  if (strictEligible) {
    const meetsCoreBar =
      verifiedStewardshipScore >= LEGACY_RULES.legacyCoreScoreMin &&
      confidenceScore >= LEGACY_RULES.legacyCoreConfidenceMin &&
      organizationSize !== "micro"

    if (meetsCoreBar) {
      return {
        legacyEligible: true,
        legacyTier: "Legacy Core",
        legacyRationale: "Verified, high-confidence, and suitable for legacy giving.",
        legacyExclusionReason: null,
      }
    }

    return {
      legacyEligible: true,
      legacyTier: "Legacy Backup",
      legacyRationale:
        organizationSize === "micro"
          ? "Eligible as a backup legacy candidate — local/small orgs are capped below Legacy Core."
          : "Eligible for legacy giving with slightly lower strength than core candidates.",
      legacyExclusionReason: null,
    }
  }

  if (verifiedStewardshipScore !== null && verifiedStewardshipScore >= 75) {
    return {
      legacyEligible: false,
      legacyTier: "Needs Legal/Financial Review",
      legacyRationale: "Not legacy eligible yet — needs more research.",
      legacyExclusionReason: failures.join("; ") || "Does not meet legacy gates yet.",
    }
  }

  return {
    legacyEligible: false,
    legacyTier: "Not Legacy Eligible",
    legacyRationale: "Not legacy eligible yet — needs more research.",
    legacyExclusionReason: failures.join("; ") || "Does not meet legacy gates yet.",
  }
}

type RankedOrganization = Organization & { scoreBreakdown: ScoreBreakdown }

function applyLegacyTiersByMissionBucket(organizations: RankedOrganization[]): RankedOrganization[] {
  const bucketGroups = new Map<string, Organization[]>()
  for (const organization of organizations) {
    const group = bucketGroups.get(organization.rankingListKey) ?? []
    group.push(organization)
    bucketGroups.set(organization.rankingListKey, group)
  }

  const legacyCoreIds = new Set<string>()

  for (const group of bucketGroups.values()) {
    const eligible = group
      .filter((organization) => organization.legacyEligible)
        .sort(
          (left, right) =>
            resolveVerifiedStewardshipScore(right) - resolveVerifiedStewardshipScore(left),
        )

    const coreSlots = Math.max(1, Math.ceil(eligible.length * 0.25))
    for (const [index, organization] of eligible.entries()) {
      const verifiedScore =
        organization.verifiedStewardshipScore ?? 0
      const meetsCoreBar =
        verifiedScore >= LEGACY_RULES.legacyCoreScoreMin &&
        organization.confidenceScore >= LEGACY_RULES.legacyCoreConfidenceMin &&
        organization.organizationSize !== "micro"

      if (index < coreSlots && meetsCoreBar) {
        legacyCoreIds.add(organization.id)
      }
    }
  }

  return organizations.map((organization) => {
    if (!organization.legacyEligible) return organization

    const legacyTier: LegacyTier = legacyCoreIds.has(organization.id) ? "Legacy Core" : "Legacy Backup"
    const legacyRationale =
      legacyTier === "Legacy Core"
        ? "Top-tier verified candidate within its mission list — suitable for legacy giving."
        : organization.legacyRationale

    const updatedScoreBreakdown: ScoreBreakdown = {
      ...organization.scoreBreakdown,
      legacyTier,
      legacyRationale,
    }

    return {
      ...organization,
      legacyTier,
      legacyRationale,
      scoreBreakdown: updatedScoreBreakdown,
    }
  })
}

function getCompactGivingRole(
  recommendation: Recommendation,
  rankingStatus: RankingStatus,
  organizationSize: OrganizationSize,
): CompactGivingRole {
  if (recommendation === "Priority Fund" && rankingStatus === "Research Complete") return "Core Charity"
  if (recommendation === "Keep" && rankingStatus === "Research Complete") return "Secondary Charity"
  if (organizationSize === "micro" && (recommendation === "Keep Small Until Research Complete" || recommendation === "Small Test Donation")) {
    return "Small Local Support"
  }
  if (recommendation === "Keep Small Until Research Complete" || recommendation === "Small Test Donation") return "Watchlist"
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
  const syncedOrganization = syncImpactMetadata(organization)
  const missionBucket = getMissionBucket(syncedOrganization.category, syncedOrganization.subcategory)
  const organizationSize = classifyOrganizationSize(syncedOrganization)
  const rankingListKey = getRankingListKey(missionBucket, syncedOrganization.subcategory)
  const rankingListLabel = getRankingListLabel(missionBucket, syncedOrganization.subcategory)
  const legalIdentity = scoreLegalIdentity(syncedOrganization)
  const accountability = scoreAccountability(syncedOrganization)
  const impact = scoreImpactEvidence(syncedOrganization)
  const financial = scoreFinancialEfficiency(syncedOrganization)
  const political = scorePoliticalRisk(syncedOrganization, missionBucket)
  const stewardshipGovernance = scoreStewardshipGovernance(syncedOrganization, legalIdentity)
  const missionFit = scoreMissionFit(syncedOrganization)
  const impactEvidenceLevel = getImpactEvidenceLevel(syncedOrganization)
  const governanceScore = stewardshipGovernance.points
  const accountabilityScore = accountability.points
  const impactEvidenceScore = impact.points
  const politicalRiskScore = political.points
  const missionFitScore = missionFit.points
  const missingFields = getMissingResearchFields(organization)
  const missingCoreFields = getMissingCoreFields(organization)
  const missingFinancialFields = getMissingFinancialFields(organization)
  const redFlags = getRedFlags(organization, legalIdentity)
  const normalizedSourceMeta = normalizeSourceMeta(organization.sourceMeta ?? {})
  const hasAnyResearch = Object.keys(normalizedSourceMeta).length > 0 || organization.researchAttempts > 0
  const legalVerificationStatus = deriveLegalVerificationStatus(
    syncedOrganization,
    legalIdentity,
    hasAnyResearch,
    missingCoreFields,
  )
  const watchdogReviewRequired = accountability.watchdogReviewRequired
  const advocacyReviewStatus = deriveAdvocacyReviewStatus(syncedOrganization, missionBucket)
  const advocacyHaystack = `${toSafeString(syncedOrganization.politicalInvolvementNotes)} ${toSafeString(syncedOrganization.notes)}`
    .toLowerCase()
    .replace(/\s+/g, " ")
  const stewardshipTotal = calculateStewardshipTotal(financial, accountability, stewardshipGovernance, missionFit)
  const preliminaryStewardshipScore = clampScore(stewardshipTotal.stewardshipScore)
  const hasFinancials = financial.status === "known" && financial.completeness === "complete"
  const categoryVerification = getCategoryVerificationFlags(organization)

  const confidenceScore = calculateConfidenceScore({
    organization,
    researchStatus: organization.researchStatus,
    financialCompleteness: stewardshipTotal.financialCompleteness,
    financialStale: financial.staleData,
    unclearIdentity: legalIdentity.unclearIdentity,
    legalVerificationStatus,
    impactEvidenceLevel,
    watchdogReviewRequired,
  })

  const rankingStatus = determineRankingStatus(
    confidenceScore,
    redFlags,
    hasAnyResearch,
    missingCoreFields,
    hasFinancials,
    legalVerificationStatus,
  )
  const verifiedStewardshipScore =
    rankingStatus === "Research Complete" &&
    legalVerificationStatus === "Verified" &&
    stewardshipTotal.financialIncluded &&
    confidenceScore >= RECOMMENDATION_THRESHOLDS.verifiedMin
      ? Math.round(preliminaryStewardshipScore * 10) / 10
      : null
  const objectiveStewardshipScore = verifiedStewardshipScore ?? Math.round(preliminaryStewardshipScore * 10) / 10
  const donorConfidence = getDonorConfidenceAdjustment(
    organization.approximateAnnualDonation,
    rankingStatus,
    legalVerificationStatus,
  )
  const personalizedStewardshipScore = clampScore(objectiveStewardshipScore + donorConfidence.points)
  const recommendation = getRecommendation(
    verifiedStewardshipScore,
    preliminaryStewardshipScore,
    confidenceScore,
    rankingStatus,
    missingCoreFields,
    redFlags,
    legalIdentity,
    legalVerificationStatus,
    accountabilityScore,
    organizationSize,
    impactEvidenceLevel,
    watchdogReviewRequired,
    advocacyReviewStatus,
    advocacyHaystack,
    stewardshipTotal.financialIncluded,
  )
  const strongestNextResearchStep = getStrongestNextResearchStep(
    missingCoreFields,
    missingFinancialFields,
    organization,
    redFlags,
  )
  const criticalMissingFields = [
    ...missingCoreFields,
    ...(stewardshipTotal.financialCompleteness !== "complete"
      ? ["programPercent", "fundraisingPercent", "adminPercent"]
      : []),
    ...(advocacyStatusNeedsPoliticalNotes(advocacyReviewStatus) ? ["politicalInvolvementNotes"] : []),
  ]
  const donationAmountAssessment = getDonationAmountAssessment(
    organization,
    verifiedStewardshipScore,
    preliminaryStewardshipScore,
    confidenceScore,
    recommendation,
    hasFinancials,
  )
  const suggestedDonationAction = getSuggestedDonationAction(recommendation, rankingStatus)
  const suggestedDonationLevel = SUGGESTED_DONATION_LEVEL_BY_RECOMMENDATION[recommendation]
  const legacyDecision = getLegacyDecision(
    verifiedStewardshipScore,
    confidenceScore,
    missingCoreFields,
    hasFinancials,
    impactEvidenceLevel,
    accountabilityScore,
    redFlags,
    legalIdentity,
    legalVerificationStatus,
    organizationSize,
    advocacyReviewStatus,
  )
  const confidenceBand = getConfidenceBand(confidenceScore)
  const scoreBand = getScoreBand(objectiveStewardshipScore, rankingStatus, confidenceScore)
  const stewardshipScoreLabel = getStewardshipScoreLabel(
    rankingStatus,
    objectiveStewardshipScore,
    stewardshipTotal.financialIncluded,
    legalVerificationStatus,
  )
  const compactGivingRole = getCompactGivingRole(recommendation, rankingStatus, organizationSize)
  const reasons: string[] = []
  if (rankingStatus !== "Research Complete") reasons.push("Preliminary research only — finish core fields before treating list rank as final.")
  if (legalVerificationStatus !== "Verified") reasons.push(`Legal verification status: ${legalVerificationStatus}.`)
  if (financial.warning) reasons.push(financial.warning)
  if (redFlags.length > 0) reasons.push("Serious concerns were identified and require manual review.")
  if (watchdogReviewRequired) reasons.push("Watchdog review is recommended before increasing giving.")
  if (impactEvidenceLevel === "Not comparable / insufficient evidence") {
    reasons.push("Impact evidence is not comparable across organizations yet.")
  } else if (impactEvidenceLevel === "Limited impact evidence") {
    reasons.push("Impact evidence is limited to weaker documentation sources.")
  }
  if (advocacyReviewStatus === "donor_comfort_review") {
    reasons.push("Advocacy or policy activity may need donor comfort review.")
  } else if (advocacyReviewStatus === "partisan_red_flag") {
    reasons.push("Partisan political activity needs donor review.")
  } else if (advocacyReviewStatus === "notes_missing") {
    reasons.push("Advocacy notes are missing — finish research before increasing giving.")
  } else if (advocacyReviewStatus === "not_reviewed") {
    reasons.push("Advocacy involvement has not been reviewed yet.")
  }
  if (donorConfidence.points > 0) reasons.push(donorConfidence.reason)

  return {
    preliminaryStewardshipScore: Math.round(preliminaryStewardshipScore * 10) / 10,
    verifiedStewardshipScore,
    objectiveStewardshipScore,
    personalizedStewardshipScore: Math.round(personalizedStewardshipScore * 10) / 10,
    stewardshipScore: objectiveStewardshipScore,
    stewardshipScoreLabel,
    donorConfidenceAdjustment: donorConfidence.points,
    donorConfidenceReason: donorConfidence.reason,
    rankShiftReason: "Rank shift is based on personalized donor-confidence adjustment versus objective rank.",
    rankingStatus,
    legalVerificationStatus,
    missionFitScore: Math.round(missionFitScore * 10) / 10,
    impactEvidenceLevel,
    financialCompletenessStatus: stewardshipTotal.financialCompleteness,
    watchdogReviewRequired,
    advocacyReviewStatus,
    rankingModelVersion: RANKING_MODEL_VERSION,
    impactEvidenceScore: Math.round(impactEvidenceScore * 10) / 10,
    accountabilityScore: Math.round(accountabilityScore * 10) / 10,
    financialEfficiencyScore: financial.status === "unknown" ? null : Math.round(financial.points * 10) / 10,
    financialEfficiencyStatus: financial.status,
    governanceScore: Math.round(governanceScore * 10) / 10,
    politicalRiskScore: Math.round(politicalRiskScore * 10) / 10,
    confidenceScore: Math.round(confidenceScore * 10) / 10,
    confidenceBand,
    scoreBand,
    organizationSize,
    identityVerified: categoryVerification.identityVerified,
    financialsVerified: categoryVerification.financialsVerified,
    impactDocumented: categoryVerification.impactDocumented,
    politicalReviewed: categoryVerification.politicalReviewed,
    recommendation,
    donationAmountAssessment,
    suggestedDonationAction,
    suggestedDonationLevel,
    legacyEligible: legacyDecision.legacyEligible,
    legacyTier: legacyDecision.legacyTier,
    legacyRationale: legacyDecision.legacyRationale,
    legacyExclusionReason: legacyDecision.legacyExclusionReason,
    missionBucket,
    rankingListKey,
    rankingListLabel,
    compactGivingRole,
    politicalInvolvementNotes: toSafeString(organization.politicalInvolvementNotes).trim(),
    impactEvidenceNotes: toSafeString(organization.impactEvidenceNotes).trim(),
    accountabilityNotes: toSafeString(organization.accountabilityNotes).trim(),
    impactSourceTier: syncedOrganization.impactSourceTier,
    quantifiedOutcomeCount: syncedOrganization.quantifiedOutcomeCount,
    impactDataYear: syncedOrganization.impactDataYear,
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
    .map((organization) => resolveVerifiedStewardshipScore(organization))
    .filter((score) => score >= 0)
  const bandWidth = 8
  let bestLowerBound = 0
  let clusteredCount = 0

  for (let lowerBound = 0; lowerBound <= 100 - bandWidth; lowerBound += 1) {
    const count = scores.filter((score) => score >= lowerBound && score < lowerBound + bandWidth).length
    if (count > clusteredCount) {
      clusteredCount = count
      bestLowerBound = lowerBound
    }
  }

  const clusteredPercent = scores.length ? Math.round((clusteredCount / scores.length) * 1000) / 10 : 0
  const clustered = clusteredPercent >= 30

  return {
    clustered,
    lowerBound: bestLowerBound,
    upperBound: bestLowerBound + bandWidth,
    clusteredCount,
    clusteredPercent,
    warning: clustered
      ? `${clusteredPercent}% of organizations score between ${bestLowerBound} and ${bestLowerBound + bandWidth}. Use recommendation tiers and legacy status — not rank number alone.`
      : null,
  }
}

export function rankOrganizations(organizations: Organization[]): Organization[] {
  const ranked: RankedOrganization[] = organizations.map((organization) => {
    const syncedOrganization = syncImpactMetadata(organization)
    const scoreBreakdown = calculateScoreBreakdown(syncedOrganization)
    return {
      ...syncedOrganization,
      preliminaryStewardshipScore: scoreBreakdown.preliminaryStewardshipScore,
      verifiedStewardshipScore: scoreBreakdown.verifiedStewardshipScore,
      objectiveStewardshipScore: scoreBreakdown.objectiveStewardshipScore,
      personalizedStewardshipScore: scoreBreakdown.personalizedStewardshipScore,
      stewardshipScore: scoreBreakdown.stewardshipScore,
      stewardshipScoreLabel: scoreBreakdown.stewardshipScoreLabel,
      sourceMeta: normalizeSourceMeta(organization.sourceMeta ?? {}),
      rankingStatus: scoreBreakdown.rankingStatus,
      donorConfidenceAdjustment: scoreBreakdown.donorConfidenceAdjustment,
      donorConfidenceReason: scoreBreakdown.donorConfidenceReason,
      legalVerificationStatus: scoreBreakdown.legalVerificationStatus,
      missionFitScore: scoreBreakdown.missionFitScore,
      impactEvidenceLevel: scoreBreakdown.impactEvidenceLevel,
      financialCompletenessStatus: scoreBreakdown.financialCompletenessStatus,
      watchdogReviewRequired: scoreBreakdown.watchdogReviewRequired,
      advocacyReviewStatus: scoreBreakdown.advocacyReviewStatus,
      rankingModelVersion: scoreBreakdown.rankingModelVersion,
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
      legacyExclusionReason: scoreBreakdown.legacyExclusionReason,
      confidenceBand: scoreBreakdown.confidenceBand,
      scoreBand: scoreBreakdown.scoreBand,
      organizationSize: scoreBreakdown.organizationSize,
      identityVerified: scoreBreakdown.identityVerified,
      financialsVerified: scoreBreakdown.financialsVerified,
      impactDocumented: scoreBreakdown.impactDocumented,
      politicalReviewed: scoreBreakdown.politicalReviewed,
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

  const rankedWithLegacyTiers = applyLegacyTiersByMissionBucket(ranked)

  const globalObjectiveRankById = buildRankMap(rankedWithLegacyTiers, "objective")
  const globalPersonalizedRankById = buildRankMap(rankedWithLegacyTiers, "personalized")

  const listGroups = new Map<string, typeof rankedWithLegacyTiers>()
  for (const organization of rankedWithLegacyTiers) {
    const listKey = organization.rankingListKey
    const group = listGroups.get(listKey) ?? []
    group.push(organization)
    listGroups.set(listKey, group)
  }

  const listObjectiveRankById = new Map<string, number>()
  const listPersonalizedRankById = new Map<string, number>()
  const listSizeById = new Map<string, number>()

  for (const [listKey, group] of listGroups.entries()) {
    const listOrganizations = rankedWithLegacyTiers.filter((organization) => organization.rankingListKey === listKey)
    const listObjectiveRanks = buildRankMap(listOrganizations, "objective")
    const listPersonalizedRanks = buildRankMap(listOrganizations, "personalized")
    for (const organization of group) {
      listObjectiveRankById.set(organization.id, listObjectiveRanks.get(organization.id) ?? 0)
      listPersonalizedRankById.set(organization.id, listPersonalizedRanks.get(organization.id) ?? 0)
      listSizeById.set(organization.id, group.length)
    }
  }

  const totalOrganizations = rankedWithLegacyTiers.length

  return rankedWithLegacyTiers.map((organization) => {
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

function compareTieBreakers(left: Organization, right: Organization): number {
  const leftWeakest = getWeakestCategoryPercent(left)
  const rightWeakest = getWeakestCategoryPercent(right)
  if (rightWeakest !== leftWeakest) return rightWeakest - leftWeakest

  const leftRedFlags = left.redFlags?.length ?? 0
  const rightRedFlags = right.redFlags?.length ?? 0
  if (leftRedFlags !== rightRedFlags) return leftRedFlags - rightRedFlags

  return left.organizationName.localeCompare(right.organizationName)
}

function buildRankMap(
  organizations: Organization[],
  mode: "objective" | "personalized",
): Map<string, number> {
  const sorted = [...organizations].sort((left, right) => {
    if (mode === "objective") {
      const leftScore = resolveObjectiveStewardshipScore(left)
      const rightScore = resolveObjectiveStewardshipScore(right)
      if (rightScore !== leftScore) {
        return rightScore - leftScore
      }
      if (right.confidenceScore !== left.confidenceScore) return right.confidenceScore - left.confidenceScore
      return compareTieBreakers(left, right)
    }

    const leftPersonalized = left.personalizedStewardshipScore
    const rightPersonalized = right.personalizedStewardshipScore
    if (rightPersonalized !== leftPersonalized) {
      return rightPersonalized - leftPersonalized
    }
    const leftObjective = left.objectiveStewardshipScore
    const rightObjective = right.objectiveStewardshipScore
    if (rightObjective !== leftObjective) {
      return rightObjective - leftObjective
    }
    if (right.confidenceScore !== left.confidenceScore) return right.confidenceScore - left.confidenceScore
    return compareTieBreakers(left, right)
  })

  return new Map(sorted.map((organization, index) => [organization.id, index + 1]))
}
