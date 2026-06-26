import { STEWARDSHIP_WEIGHTS } from "../config/ranking-config.js"
import type { Organization, Recommendation, ScoreBreakdown, ScoreCategoryExplanation } from "../types/organization.js"
import {
  advocacyReviewStatusSummary,
  advocacyStatusCapsRecommendation,
} from "./advocacy-review-service.js"
import { resolveStewardshipScoreFields } from "./stewardship-score-fields.js"

export type ScoreLevel = "Strong" | "Good" | "Moderate" | "Low" | "Unknown"

function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return String(value)
}

function getScoreLevel(score: number | null, maxPoints = 100): ScoreLevel {
  if (score === null) return "Unknown"
  const percent = (score / maxPoints) * 100
  if (percent >= 85) return "Strong"
  if (percent >= 70) return "Good"
  if (percent >= 55) return "Moderate"
  return "Low"
}

function formatCategoryScore(score: number | null, maxPoints = 100): string {
  if (score === null) return "Not available yet"
  return `${score} / ${maxPoints}`
}

function getRankTierLabel(rank: number, total: number): string {
  if (total <= 1) return "your only organization"
  const percentile = rank / total
  if (rank === 1) return "the top organization on your list"
  if (rank === total) return "the lowest-ranked organization on your list"
  if (percentile <= 0.25) return "in the top quarter of your list"
  if (percentile <= 0.5) return "in the upper half of your list"
  if (percentile <= 0.75) return "in the lower half of your list"
  return "near the bottom of your list"
}

function getRecommendationTitle(recommendation: Recommendation): string {
  const titles: Record<Recommendation, string> = {
    "Priority Fund": "Strong choice for continued support",
    Keep: "Good fit to keep supporting",
    "Keep Small Until Research Complete": "Keep giving, but stay small for now",
    Reduce: "Consider reducing this gift",
    "Small Test Donation": "Try a small gift while research continues",
    "Review Before Donating": "Review before your next gift",
    "Pause / Do Not Fund": "Pause or stop this gift",
  }
  return titles[recommendation]
}

function getRecommendationExplanation(recommendation: Recommendation, score: ScoreBreakdown): string {
  if (recommendation === "Priority Fund") {
    return "This organization has strong stewardship, high confidence, and impact evidence at least Basic — a strong candidate for regular giving."
  }
  if (recommendation === "Keep") {
    return "This organization has solid stewardship and acceptable confidence. Impact evidence is shown separately and is not required for Keep."
  }
  if (recommendation === "Keep Small Until Research Complete") {
    return "Stewardship looks promising, but research or financial data is still incomplete. A smaller gift is safer until verification is complete."
  }
  if (recommendation === "Small Test Donation") {
    return "The mission may be a good fit, but research is not complete enough for a confident long-term ranking yet."
  }
  if (recommendation === "Reduce") {
    return "Stewardship or accountability is weaker than peers on your list. Consider lowering the amount you give."
  }
  if (recommendation === "Pause / Do Not Fund") {
    return "Legal verification failed or serious concerns were found. Pausing this gift is the safer choice until issues are resolved."
  }
  if (score.watchdogReviewRequired) {
    return "Watchdog review is recommended because of a poor CharityWatch grade or low Charity Navigator rating. Review before increasing giving."
  }
  if (advocacyStatusCapsRecommendation(score.advocacyReviewStatus)) {
    return `${advocacyReviewStatusSummary(score.advocacyReviewStatus)} Confirm you are comfortable with policy-focused giving before increasing support.`
  }
  if (score.rankingStatus !== "Research Complete") {
    return "More research is still needed before this organization can be ranked with full confidence. Review the details below before your next gift."
  }
  return "Stewardship is acceptable in some areas but not strong enough overall for an automatic keep recommendation. Review the breakdown below."
}

function explainLegalVerification(organization: Organization, score: ScoreBreakdown): ScoreCategoryExplanation {
  const details: string[] = []
  const status = score.legalVerificationStatus

  if (toSafeString(organization.ein).trim()) details.push(`EIN on file: ${organization.ein}.`)
  else details.push("No reliable EIN on file.")

  if (toSafeString(organization.is501c3Verified).trim().toLowerCase() === "y") {
    details.push("501(c)(3) status is verified.")
  } else {
    details.push("501(c)(3) status still needs confirmation.")
  }

  if (score.redFlags.some((flag) => flag.toLowerCase().includes("identity"))) {
    details.push("Identity or alias concerns were noted in research.")
  }

  details.push("Legal verification is a gate — it is not part of the stewardship score.")

  let whyThisScore = `Legal verification status: ${status}.`
  if (status === "Verified") {
    whyThisScore += " Legal identity checks look sufficient to rank normally."
  } else if (status === "Needs Review") {
    whyThisScore += " Some legal details still need confirmation before increasing giving."
  } else if (status === "Failed Verification") {
    whyThisScore += " Revoked status or serious identity problems block positive recommendations."
  } else {
    whyThisScore += " Not enough research yet to confirm legal status."
  }

  return {
    key: "legalVerification",
    title: "Legal verification",
    score: null,
    maxPoints: 100,
    weightPercent: 0,
    categoryType: "gate",
    level: status === "Verified" ? "Strong" : status === "Needs Review" ? "Moderate" : "Low",
    whatItMeasures: "Whether the organization is legally verified, tax-deductible, and clearly identified as the correct payee.",
    whyThisScore,
    details,
  }
}

function explainStewardshipFinancial(organization: Organization, score: ScoreBreakdown): ScoreCategoryExplanation {
  const details: string[] = []
  const completeness = score.financialCompletenessStatus

  if (completeness === "complete") {
    if (organization.programPercent !== null) {
      details.push(`Program spending: ${organization.programPercent}%.`)
    }
    if (organization.fundraisingPercent !== null) {
      details.push(`Fundraising cost: ${organization.fundraisingPercent}%.`)
    }
    if (organization.adminPercent !== null) {
      details.push(`Administration cost: ${organization.adminPercent}%.`)
    }
    details.push("All three ratios are verified and included in the stewardship score.")
  } else if (completeness === "partial") {
    details.push("One or more financial ratios are missing — the financial component is excluded and remaining categories are renormalized.")
  } else {
    details.push("Financial ratios are not verified yet — the financial component is excluded and remaining categories are renormalized.")
  }

  const financialScore = score.financialEfficiencyScore
  let whyThisScore =
    completeness === "complete"
      ? `Financial efficiency scored ${formatCategoryScore(financialScore)} and counts for ${STEWARDSHIP_WEIGHTS.financialEfficiency}% of stewardship.`
      : "Financial efficiency is not included in the stewardship score because verified ratios are incomplete."

  if (completeness === "complete" && financialScore !== null) {
    const percent = financialScore
    if (percent >= 85) whyThisScore += " Spending looks efficient based on the available ratios."
    else if (percent >= 70) whyThisScore += " Spending is decent overall."
    else whyThisScore += " A larger share may be going to fundraising or overhead than ideal."
  }

  return {
    key: "financialEfficiency",
    title: "Financial health & efficiency",
    score: completeness === "complete" ? financialScore : null,
    maxPoints: 100,
    weightPercent: STEWARDSHIP_WEIGHTS.financialEfficiency,
    categoryType: "stewardship",
    level: completeness === "complete" ? getScoreLevel(financialScore) : "Unknown",
    whatItMeasures: "How much of each dollar goes to programs versus fundraising and administration.",
    whyThisScore,
    details,
  }
}

function explainStewardshipAccountability(organization: Organization, score: ScoreBreakdown): ScoreCategoryExplanation {
  const details: string[] = []

  if (toSafeString(organization.website).trim()) details.push("Official website is on file.")
  if (score.accountabilityNotes.trim()) details.push("Accountability notes document public reporting.")

  if (organization.charityNavigatorRating !== null) {
    const rating = organization.charityNavigatorRating
    if (rating >= 4) {
      details.push(`Charity Navigator ${rating} stars supports accountability confidence.`)
    } else if (rating >= 3) {
      details.push(`Charity Navigator ${rating} stars is acceptable accountability coverage.`)
    } else {
      details.push(`Charity Navigator ${rating} stars is below average and triggered watchdog review.`)
    }
  }

  if (organization.charityWatchGrade) {
    const grade = organization.charityWatchGrade.toUpperCase()
    if (grade === "D" || grade === "F") {
      details.push(`CharityWatch grade ${organization.charityWatchGrade} is poor and penalizes accountability.`)
    } else if (grade.startsWith("C")) {
      details.push(`CharityWatch grade ${organization.charityWatchGrade} is neutral and warrants review.`)
    } else {
      details.push(`CharityWatch grade ${organization.charityWatchGrade} supports accountability confidence.`)
    }
  }

  if (organization.aceRecommendation) {
    details.push(`Animal Charity Evaluators status: ${organization.aceRecommendation}.`)
  }

  if (organization.charityNavigatorAlert?.trim()) {
    details.push(`Charity Navigator alert: ${organization.charityNavigatorAlert}.`)
  }

  const percent = score.accountabilityScore
  let whyThisScore = `Accountability scored ${formatCategoryScore(score.accountabilityScore)} and counts for ${STEWARDSHIP_WEIGHTS.accountability}% of stewardship.`
  if (percent >= 85) whyThisScore += " Transparency documentation is strong."
  else if (percent >= 56) whyThisScore += " Basic accountability checks look good."
  else whyThisScore += " Key accountability information is still missing or weak."

  return {
    key: "accountability",
    title: "Accountability & transparency",
    score: score.accountabilityScore,
    maxPoints: 100,
    weightPercent: STEWARDSHIP_WEIGHTS.accountability,
    categoryType: "stewardship",
    level: getScoreLevel(score.accountabilityScore),
    whatItMeasures: "Whether the organization shares enough public information to trust where donations go.",
    whyThisScore,
    details,
  }
}

function explainStewardshipGovernance(organization: Organization, score: ScoreBreakdown): ScoreCategoryExplanation {
  const details: string[] = []

  if (toSafeString(organization.website).trim()) {
    details.push("Public website helps confirm the organization is active.")
  }
  if (organization.researchStatus === "complete") {
    details.push("Research status is complete.")
  } else if (organization.researchStatus === "failed") {
    details.push("Automated research had trouble confirming some governance details.")
  }

  details.push("Governance hygiene covers filing sources and identity clarity — not EIN or 501(c)(3), which are under legal verification.")

  const percent = score.governanceScore
  let whyThisScore = `Governance hygiene scored ${formatCategoryScore(score.governanceScore)} and counts for ${STEWARDSHIP_WEIGHTS.governance}% of stewardship.`
  if (percent >= 85) whyThisScore += " Governance documentation looks solid."
  else if (percent >= 70) whyThisScore += " Governance hygiene is acceptable."
  else whyThisScore += " Governance hygiene needs more verified sources."

  return {
    key: "governance",
    title: "Governance hygiene",
    score: score.governanceScore,
    maxPoints: 100,
    weightPercent: STEWARDSHIP_WEIGHTS.governance,
    categoryType: "stewardship",
    level: getScoreLevel(score.governanceScore),
    whatItMeasures: "Whether IRS sources, recent research, and public presence support trust in organizational governance.",
    whyThisScore,
    details,
  }
}

function explainMissionFit(score: ScoreBreakdown): ScoreCategoryExplanation {
  const details: string[] = []

  if (score.missionFitScore >= 85) {
    details.push("Marked as a primary organization within its mission overlap group.")
  } else if (score.missionFitScore >= 70) {
    details.push("Neutral or secondary mission-fit role within its overlap group.")
  } else {
    details.push("Marked as phasing out or lower priority within its mission overlap group.")
  }

  details.push(`Mission fit counts for ${STEWARDSHIP_WEIGHTS.missionFit}% of stewardship within the mission list.`)

  return {
    key: "missionFit",
    title: "Mission fit within list",
    score: score.missionFitScore,
    maxPoints: 100,
    weightPercent: STEWARDSHIP_WEIGHTS.missionFit,
    categoryType: "stewardship",
    level: getScoreLevel(score.missionFitScore),
    whatItMeasures: "How clearly this organization fits its mission bucket and your portfolio overlap tags.",
    whyThisScore: `Mission fit scored ${formatCategoryScore(score.missionFitScore)} within its ranking list.`,
    details,
  }
}

function explainImpactEvidenceLevel(organization: Organization, score: ScoreBreakdown): ScoreCategoryExplanation {
  const details: string[] = []
  const level = score.impactEvidenceLevel

  details.push(`Impact evidence level: ${level}.`)
  details.push("Not part of the stewardship score — impact documentation varies widely across organizations.")
  details.push(`Reference impact subscore: ${formatCategoryScore(score.impactEvidenceScore)} (informational only).`)

  if ((score.quantifiedOutcomeCount ?? 0) > 0) {
    details.push(`${score.quantifiedOutcomeCount} quantified outcomes detected in research notes.`)
  }

  if (organization.impactSourceTier && organization.impactSourceTier !== "none") {
    details.push(`Primary impact source tier: ${organization.impactSourceTier.replace(/_/g, " ")}.`)
  }

  if (score.impactEvidenceNotes.trim()) {
    details.push("Impact notes are on file.")
  } else {
    details.push("Detailed impact notes are still limited.")
  }

  let categoryLevel: ScoreLevel = "Moderate"
  if (level === "Strong documented impact") categoryLevel = "Strong"
  else if (level === "Basic documented impact") categoryLevel = "Good"
  else if (level === "Limited impact evidence") categoryLevel = "Low"
  else categoryLevel = "Unknown"

  return {
    key: "impactEvidenceLevel",
    title: "Impact evidence level",
    score: score.impactEvidenceScore,
    maxPoints: 100,
    weightPercent: 0,
    categoryType: "badge",
    level: categoryLevel,
    whatItMeasures: "How well documented this organization's outcomes are — separate from stewardship ranking.",
    whyThisScore: `Impact is shown as a level badge because documentation quality is uneven across organizations. Priority Fund requires at least Basic impact evidence.`,
    details,
  }
}

function explainReviewFlags(score: ScoreBreakdown): ScoreCategoryExplanation {
  const details: string[] = []

  if (score.watchdogReviewRequired) {
    details.push("Watchdog review recommended — poor CharityWatch grade or low Charity Navigator rating.")
  } else {
    details.push("No watchdog review flag.")
  }

  details.push(advocacyReviewStatusSummary(score.advocacyReviewStatus))

  details.push("Review flags can cap recommendations but do not change the stewardship score.")

  const hasFlags = score.watchdogReviewRequired || advocacyStatusCapsRecommendation(score.advocacyReviewStatus)
  return {
    key: "reviewFlags",
    title: "Review flags",
    score: null,
    maxPoints: 100,
    weightPercent: 0,
    categoryType: "flag",
    level: hasFlags ? "Moderate" : "Strong",
    whatItMeasures: "Watchdog and advocacy signals that need donor review before increasing giving.",
    whyThisScore: hasFlags
      ? "One or more review flags are active. Check these before treating a strong stewardship score as a full keep recommendation."
      : "No active watchdog or advocacy review flags.",
    details,
  }
}

function buildStrengthsAndConcerns(categories: ScoreCategoryExplanation[], score: ScoreBreakdown): {
  strengths: string[]
  concerns: string[]
} {
  const strengths = categories
    .filter((category) => category.categoryType === "stewardship" && (category.level === "Strong" || category.level === "Good"))
    .map((category) => `${category.title} is ${category.level.toLowerCase()} (${formatCategoryScore(category.score)}).`)

  if (score.impactEvidenceLevel === "Strong documented impact" || score.impactEvidenceLevel === "Basic documented impact") {
    strengths.push(`Impact evidence level: ${score.impactEvidenceLevel}.`)
  }

  if (score.legalVerificationStatus === "Verified") {
    strengths.push("Legal verification: Verified.")
  }

  const concerns = categories
    .filter((category) => category.categoryType === "stewardship" && (category.level === "Low" || category.level === "Unknown"))
    .map((category) =>
      category.level === "Unknown"
        ? `${category.title} is not fully verified yet.`
        : `${category.title} is weaker (${formatCategoryScore(category.score)}).`,
    )

  if (score.legalVerificationStatus !== "Verified") {
    concerns.unshift(`Legal verification: ${score.legalVerificationStatus}.`)
  }

  if (score.financialCompletenessStatus !== "complete") {
    concerns.push(
      score.financialCompletenessStatus === "partial"
        ? "Financial ratios are partial — stewardship score is renormalized without the financial component."
        : "Financial ratios are missing — stewardship score is renormalized without the financial component.",
    )
  }

  if (score.impactEvidenceLevel === "Limited impact evidence" || score.impactEvidenceLevel === "Not comparable / insufficient evidence") {
    concerns.push(`Impact evidence level: ${score.impactEvidenceLevel}.`)
  }

  if (score.watchdogReviewRequired) concerns.push("Watchdog review is recommended.")
  if (advocacyStatusCapsRecommendation(score.advocacyReviewStatus)) {
    concerns.push(advocacyReviewStatusSummary(score.advocacyReviewStatus))
  } else if (score.advocacyReviewStatus === "notes_missing" || score.advocacyReviewStatus === "not_reviewed") {
    concerns.push(advocacyReviewStatusSummary(score.advocacyReviewStatus))
  }

  if (score.redFlags.length > 0) {
    concerns.unshift(...score.redFlags.map((flag) => `Red flag: ${flag}`))
  }

  if (score.criticalMissingFields.length > 0) {
    concerns.push("Some important research fields are still missing.")
  }

  return { strengths, concerns }
}

export function buildOrganizationRankingExplanation(
  organization: Organization,
  totalOrganizations: number,
): import("../types/organization.js").OrganizationDetailExplanation {
  const score = organization.scoreBreakdown
  if (!score) {
    return {
      headline: "Ranking explanation unavailable",
      overallSummary: "This organization does not have enough ranking data yet.",
      rankExplanation: "Rank will appear after research is complete.",
      personalizedRankExplanation: "Personalized rank will appear after research is complete.",
      recommendationTitle: "Review Before Donating",
      recommendationExplanation: "Complete research before making a giving decision.",
      donorHistoryExplanation: organization.donationAmountAssessment,
      bottomLine: "Bottom line: more research is needed before this organization can be ranked confidently.",
      strengths: [],
      concerns: ["Ranking data is not available yet."],
      categories: [],
      missingDataNote: "Run research to generate a full explanation.",
    }
  }

  const listObjectiveRank = organization.listObjectiveRank ?? organization.objectiveRank
  const listPersonalizedRank = organization.listPersonalizedRank ?? organization.personalizedRank
  const globalObjectiveRank = organization.globalObjectiveRank ?? organization.objectiveRank
  const globalPersonalizedRank = organization.globalPersonalizedRank ?? organization.personalizedRank
  const rankingListSize = organization.rankingListSize ?? totalOrganizations
  const rankingListLabel = organization.rankingListLabel || score.rankingListLabel
  const stewardshipFields = resolveStewardshipScoreFields(score)
  const stewardshipScore = stewardshipFields.objectiveStewardshipScore
  const personalizedScore = stewardshipFields.personalizedStewardshipScore
  const listRankTier = getRankTierLabel(listObjectiveRank, rankingListSize)
  const renormalized = score.financialCompletenessStatus !== "complete"

  const categories = [
    explainLegalVerification(organization, score),
    explainStewardshipFinancial(organization, score),
    explainStewardshipAccountability(organization, score),
    explainStewardshipGovernance(organization, score),
    explainMissionFit(score),
    explainImpactEvidenceLevel(organization, score),
    explainReviewFlags(score),
  ]

  const { strengths, concerns } = buildStrengthsAndConcerns(categories, score)

  const headline =
    listObjectiveRank === rankingListSize && rankingListSize > 1
      ? `Ranked #${listObjectiveRank} of ${rankingListSize} in ${rankingListLabel} by stewardship — lowest in this list, but not necessarily a bad organization`
      : listObjectiveRank === 1
        ? `Ranked #1 of ${rankingListSize} in ${rankingListLabel} by stewardship`
        : `Ranked #${listObjectiveRank} of ${rankingListSize} in ${rankingListLabel} by stewardship`

  const overallSummary =
    score.redFlags.length > 0
      ? `${organization.organizationName} is ${listRankTier} within ${rankingListLabel} with a stewardship score of ${stewardshipScore}${renormalized ? "*" : ""}. Concerns need manual review before giving more. Impact evidence level: ${score.impactEvidenceLevel}.`
      : score.rankingStatus === "Research Complete"
        ? `${organization.organizationName} is ${listRankTier} within ${rankingListLabel} with a stewardship score of ${stewardshipScore}${renormalized ? "*" : ""} out of 100. Impact evidence level: ${score.impactEvidenceLevel}. List rank is based on stewardship, not impact documentation.`
        : `${organization.organizationName} is ${listRankTier} within ${rankingListLabel}, but the stewardship score of ${stewardshipScore}${renormalized ? "*" : ""} is still preliminary because research is incomplete. Impact evidence level: ${score.impactEvidenceLevel}.`

  const rankExplanation =
    listObjectiveRank === listPersonalizedRank
      ? `Within ${rankingListLabel}, objective list rank #${listObjectiveRank} is based on stewardship score. Your personalized list rank is also #${listPersonalizedRank}${score.donorConfidenceAdjustment > 0 ? " — the small donor boost was not enough to move it up against stronger peers in this list" : ""}. Across all ${totalOrganizations} organizations, global ranks are #${globalObjectiveRank} objective and #${globalPersonalizedRank} personalized.`
      : listPersonalizedRank < listObjectiveRank
        ? `Within ${rankingListLabel}, objective list rank is #${listObjectiveRank}. Your personalized list rank is #${listPersonalizedRank} because prior giving history added a small boost of +${score.donorConfidenceAdjustment} to the stewardship score. Global ranks: #${globalObjectiveRank} objective, #${globalPersonalizedRank} personalized.`
        : `Within ${rankingListLabel}, objective list rank is #${listObjectiveRank}. Personalized list rank is #${listPersonalizedRank} after comparing against similar organizations you support. Global ranks: #${globalObjectiveRank} objective, #${globalPersonalizedRank} personalized.`

  const personalizedRankExplanation =
    score.donorConfidenceAdjustment > 0
      ? `You currently give about $${Math.round(organization.approximateAnnualDonation)} per year. That history adds a small +${score.donorConfidenceAdjustment} point boost to stewardship (personalized score ${personalizedScore}), acknowledging prior confidence — but it does not override the objective stewardship score of ${stewardshipScore}.`
      : organization.approximateAnnualDonation > 0
        ? `You give about $${Math.round(organization.approximateAnnualDonation)} per year, but no donor boost was applied because research is not fully verified yet or the boost was too small to change rank meaningfully.`
        : "No prior annual donation is recorded, so personalized rank matches the objective stewardship-based rank."

  const donorHistoryExplanation = score.donationAmountAssessment

  const bottomLine =
    score.recommendation === "Priority Fund" || score.recommendation === "Keep"
      ? "Bottom line: stewardship and confidence support continued giving within this mission list. Check impact evidence level separately."
      : score.recommendation === "Pause / Do Not Fund"
        ? "Bottom line: pause this gift until legal verification or red-flag concerns are resolved."
        : score.recommendation === "Reduce"
          ? "Bottom line: consider giving less here and moving support toward higher-stewardship organizations in this list."
          : listObjectiveRank === rankingListSize && rankingListSize > 1
            ? `Bottom line: this is the lowest stewardship rank in ${rankingListLabel}, but that reflects comparable financial and accountability data — not necessarily mission value.`
            : "Bottom line: review stewardship, impact evidence level, and review flags below before your next gift."

  const missingDataNote =
    score.criticalMissingFields.length > 0
      ? `Some information is still missing (${score.criticalMissingFields.length} important fields). Best next step: ${score.strongestNextResearchStep}.`
      : score.missingFields.length > 0
        ? `Optional research still available: ${score.strongestNextResearchStep}.`
        : renormalized
          ? "Financial ratios are incomplete — stewardship score excludes the financial component and renormalizes the rest."
          : null

  return {
    headline,
    overallSummary,
    rankExplanation,
    personalizedRankExplanation,
    recommendationTitle: getRecommendationTitle(score.recommendation),
    recommendationExplanation: getRecommendationExplanation(score.recommendation, score),
    donorHistoryExplanation,
    bottomLine,
    strengths,
    concerns,
    categories,
    missingDataNote,
  }
}
