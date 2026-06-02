import { DONATION_WORTHINESS_WEIGHTS } from "../config/ranking-config.js"
import { RUBRIC_CATEGORY_MAX_POINTS } from "../config/ranking-rubric-config.js"
import type { Organization, Recommendation, ScoreBreakdown } from "../types/organization.js"

export type ScoreLevel = "Strong" | "Good" | "Moderate" | "Low" | "Unknown"

export interface ScoreCategoryExplanation {
  key: string
  title: string
  score: number | null
  maxPoints: number
  weightPercent: number
  level: ScoreLevel
  whatItMeasures: string
  whyThisScore: string
  details: string[]
}

export interface OrganizationDetailExplanation {
  headline: string
  overallSummary: string
  rankExplanation: string
  personalizedRankExplanation: string
  recommendationTitle: string
  recommendationExplanation: string
  donorHistoryExplanation: string
  bottomLine: string
  strengths: string[]
  concerns: string[]
  categories: ScoreCategoryExplanation[]
  missingDataNote: string | null
}

function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return String(value)
}

function getScoreLevel(score: number | null, maxPoints: number): ScoreLevel {
  if (score === null) return "Unknown"
  const percent = (score / maxPoints) * 100
  if (percent >= 85) return "Strong"
  if (percent >= 70) return "Good"
  if (percent >= 55) return "Moderate"
  return "Low"
}

function formatCategoryScore(score: number | null, maxPoints: number): string {
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
    "Keep Small Until Verified": "Keep giving, but stay small for now",
    Reduce: "Consider reducing this gift",
    "Small Test Donation": "Try a small gift while research continues",
    "Review Before Donating": "Review before your next gift",
    "Pause / Do Not Fund": "Pause or stop this gift",
  }
  return titles[recommendation]
}

function getRecommendationExplanation(recommendation: Recommendation, score: ScoreBreakdown): string {
  if (recommendation === "Priority Fund") {
    return "This organization scores highly and has enough verified research to be a strong candidate for regular giving."
  }
  if (recommendation === "Keep") {
    return "This organization performs well overall and is a reasonable choice to keep in your giving plan."
  }
  if (recommendation === "Keep Small Until Verified") {
    return "The organization looks promising, but some information is still being verified. A smaller gift is safer until research is complete."
  }
  if (recommendation === "Small Test Donation") {
    return "The mission may be a good fit, but the research is not complete enough for a confident long-term ranking yet."
  }
  if (recommendation === "Reduce") {
    return "The evidence suggests this organization is weaker than others on your list. Consider lowering the amount you give."
  }
  if (recommendation === "Pause / Do Not Fund") {
    return "There are serious concerns or a very low score. Pausing this gift is the safer choice until issues are resolved."
  }
  const politicalPercent = (score.politicalRiskScore / RUBRIC_CATEGORY_MAX_POINTS.politicalRisk) * 100
  if (politicalPercent < 60) {
    return "This is not necessarily a bad organization. The system is flagging it for review because of advocacy or political activity, missing information, or a score that is good but not strong enough for a simple keep recommendation."
  }
  if (score.rankingStatus !== "Verified Ranking") {
    return "More research is still needed before this organization can be ranked with full confidence. Review the details below before your next gift."
  }
  return "This organization is acceptable in some areas but not strong enough overall for an automatic keep recommendation. Review the score breakdown below to decide whether it still fits your personal priorities."
}

function explainImpactEvidence(organization: Organization, score: ScoreBreakdown): ScoreCategoryExplanation {
  const maxPoints = RUBRIC_CATEGORY_MAX_POINTS.impactEvidence
  const details: string[] = []
  if (score.impactEvidenceNotes.trim()) {
    details.push("Impact notes were found and added to the score.")
  } else {
    details.push("Detailed impact notes are still missing.")
  }
  if (toSafeString(organization.notes).toLowerCase().includes("annual report")) {
    details.push("Annual report information was found in the research notes.")
  }
  details.push("Watchdog ratings count toward accountability, not impact — impact requires documented outcomes.")

  const percent = (score.impactEvidenceScore / maxPoints) * 100
  let whyThisScore = `Impact evidence scored ${formatCategoryScore(score.impactEvidenceScore, maxPoints)}.`
  if (percent >= 80) {
    whyThisScore += " There is solid documentation of results or outcomes."
  } else if (percent >= 55) {
    whyThisScore += " Some impact information exists, but it is not as strong as top-ranked organizations."
  } else if (score.impactEvidenceScore > 0) {
    whyThisScore += " Limited proof of measurable outcomes is available so far."
  } else {
    whyThisScore += " No documented impact evidence yet — mission fit alone does not earn a high impact score."
  }

  return {
    key: "impactEvidence",
    title: "Impact evidence",
    score: score.impactEvidenceScore,
    maxPoints,
    weightPercent: DONATION_WORTHINESS_WEIGHTS.impactEvidence,
    level: getScoreLevel(score.impactEvidenceScore, maxPoints),
    whatItMeasures: "How much proof exists that this organization actually achieves meaningful results.",
    whyThisScore,
    details,
  }
}

function explainAccountability(organization: Organization, score: ScoreBreakdown): ScoreCategoryExplanation {
  const maxPoints = RUBRIC_CATEGORY_MAX_POINTS.accountability
  const details: string[] = []
  if (toSafeString(organization.website).trim()) details.push("Official website is on file.")
  if (score.accountabilityNotes.trim()) details.push("Accountability notes document public financial reporting.")
  if (organization.charityNavigatorRating !== null) details.push("Charity Navigator rating adds watchdog accountability confidence.")
  if (organization.charityWatchGrade) details.push(`CharityWatch grade ${organization.charityWatchGrade} adds watchdog accountability confidence.`)
  if (organization.aceRecommendation) details.push(`ACE ${organization.aceRecommendation} status adds independent validation.`)
  if (organization.charityNavigatorAlert?.trim()) {
    details.push(`Charity Navigator alert on file: ${organization.charityNavigatorAlert}.`)
  }
  details.push("Legal identity checks (EIN, 501(c)(3)) are scored separately under verified legal status.")

  const percent = (score.accountabilityScore / maxPoints) * 100
  let whyThisScore = `Accountability scored ${formatCategoryScore(score.accountabilityScore, maxPoints)}.`
  if (percent >= 85) {
    whyThisScore += " This organization is transparent and well documented."
  } else if (percent >= 56) {
    whyThisScore += " Basic accountability checks look good, with room to add more watchdog ratings."
  } else {
    whyThisScore += " Key accountability information is still missing or incomplete."
  }

  return {
    key: "accountability",
    title: "Accountability and transparency",
    score: score.accountabilityScore,
    maxPoints,
    weightPercent: DONATION_WORTHINESS_WEIGHTS.accountability,
    level: getScoreLevel(score.accountabilityScore, maxPoints),
    whatItMeasures: "Whether the organization shares enough public information to trust where donations go.",
    whyThisScore,
    details,
  }
}

function explainFinancialEfficiency(organization: Organization, score: ScoreBreakdown): ScoreCategoryExplanation {
  const maxPoints = RUBRIC_CATEGORY_MAX_POINTS.financialEfficiency
  const details: string[] = []

  if (score.financialEfficiencyStatus === "unknown") {
    return {
      key: "financialEfficiency",
      title: "Financial efficiency",
      score: null,
      maxPoints,
      weightPercent: DONATION_WORTHINESS_WEIGHTS.financialEfficiency,
      level: "Unknown",
      whatItMeasures: "How much of each dollar goes to programs versus fundraising and administration.",
      whyThisScore:
        "Financial efficiency could not be scored yet because program, fundraising, and admin percentages are missing or not verified from a Form 990 or trusted charity rating source.",
      details: ["Next step: find and verify the latest Form 990 or charity watchdog data."],
    }
  }

  if (organization.programPercent !== null) {
    details.push(`Program spending: ${organization.programPercent}% (money going directly to the mission).`)
  }
  if (organization.fundraisingPercent !== null) {
    const fundraisingNote =
      organization.fundraisingPercent <= 15
        ? "Fundraising costs look reasonable."
        : organization.fundraisingPercent <= 22
          ? "Fundraising costs are a bit high but not unusual."
          : "Fundraising costs are on the high side."
    details.push(`Fundraising cost: ${organization.fundraisingPercent}%. ${fundraisingNote}`)
  }
  if (organization.adminPercent !== null) {
    details.push(`Administration cost: ${organization.adminPercent}%.`)
  }

  const financialScore = score.financialEfficiencyScore ?? 0
  const percent = (financialScore / maxPoints) * 100
  let whyThisScore = `Financial efficiency scored ${formatCategoryScore(financialScore, maxPoints)}.`
  if (percent >= 85) {
    whyThisScore += " Spending looks efficient based on the available ratios."
  } else if (percent >= 70) {
    whyThisScore += " Spending is decent overall, though not among the most efficient on your list."
  } else {
    whyThisScore += " A larger share may be going to fundraising or overhead than ideal."
  }

  return {
    key: "financialEfficiency",
    title: "Financial efficiency",
    score: score.financialEfficiencyScore,
    maxPoints,
    weightPercent: DONATION_WORTHINESS_WEIGHTS.financialEfficiency,
    level: getScoreLevel(score.financialEfficiencyScore, maxPoints),
    whatItMeasures: "How much of each dollar goes to programs versus fundraising and administration.",
    whyThisScore,
    details,
  }
}

function explainGovernance(organization: Organization, score: ScoreBreakdown): ScoreCategoryExplanation {
  const maxPoints = RUBRIC_CATEGORY_MAX_POINTS.governance
  const details: string[] = []
  if (toSafeString(organization.ein).trim()) details.push("Legal EIN is on file.")
  if (toSafeString(organization.is501c3Verified).trim().toLowerCase() === "y") details.push("Registered nonprofit status is confirmed.")
  if (toSafeString(organization.website).trim()) details.push("Public website helps confirm the organization is active and reachable.")
  if (organization.researchStatus === "failed") details.push("Automated research had trouble confirming some details.")
  details.push("This category also acts as a safety gate — unclear identity triggers review before donating.")

  const percent = (score.governanceScore / maxPoints) * 100
  let whyThisScore = `Verified legal status scored ${formatCategoryScore(score.governanceScore, maxPoints)}.`
  if (percent >= 85) {
    whyThisScore += " Legal standing and identity checks look solid."
  } else if (percent >= 70) {
    whyThisScore += " Legal identity looks acceptable, with one secondary detail still to confirm."
  } else if (score.governanceScore > 0) {
    whyThisScore += " Legal identity or EIN uncertainty lowered this score."
  } else {
    whyThisScore += " Revoked status, missing EIN, or major identity concerns triggered the lowest score."
  }

  return {
    key: "governance",
    title: "Verified legal status and identity",
    score: score.governanceScore,
    maxPoints,
    weightPercent: DONATION_WORTHINESS_WEIGHTS.governance,
    level: getScoreLevel(score.governanceScore, maxPoints),
    whatItMeasures: "Whether the organization is legally verified, tax-deductible, and clearly identified as the correct payee.",
    whyThisScore,
    details,
  }
}

function explainPoliticalRisk(organization: Organization, score: ScoreBreakdown): ScoreCategoryExplanation {
  const maxPoints = RUBRIC_CATEGORY_MAX_POINTS.politicalRisk
  const notes = `${score.politicalInvolvementNotes} ${toSafeString(organization.notes)}`.toLowerCase()
  const details: string[] = []

  if (score.politicalInvolvementNotes.trim()) {
    details.push(score.politicalInvolvementNotes.trim())
  } else {
    details.push("No political or advocacy notes recorded yet.")
  }
  if (notes.includes("campaign") || notes.includes("lobby")) {
    details.push("The organization engages in advocacy, lobbying, or campaign-style activity.")
  }
  if (notes.includes("nonpartisan") || notes.includes("low political")) {
    details.push("Notes suggest limited or nonpartisan political involvement.")
  }
  details.push("Animal legal advocacy is scored for transparency, not penalized for policy work alone.")

  const percent = (score.politicalRiskScore / maxPoints) * 100
  let whyThisScore = `Political and advocacy alignment scored ${formatCategoryScore(score.politicalRiskScore, maxPoints)}.`
  if (percent >= 75) {
    whyThisScore += " Advocacy involvement appears limited or clearly documented, with low concern for most donors."
  } else if (percent >= 55) {
    whyThisScore +=
      " The organization does meaningful advocacy work. This is not automatically bad, but you may want to confirm you are comfortable supporting policy-focused giving."
  } else {
    whyThisScore += " Political involvement is unclear or potentially high. Review this carefully before donating."
  }

  return {
    key: "politicalRisk",
    title: "Political and advocacy alignment",
    score: score.politicalRiskScore,
    maxPoints,
    weightPercent: DONATION_WORTHINESS_WEIGHTS.politicalRisk,
    level: getScoreLevel(score.politicalRiskScore, maxPoints),
    whatItMeasures: "How comfortable a typical donor might be with this organization's political or advocacy activity.",
    whyThisScore,
    details,
  }
}

function buildStrengthsAndConcerns(categories: ScoreCategoryExplanation[], score: ScoreBreakdown): {
  strengths: string[]
  concerns: string[]
} {
  const strengths = categories
    .filter((category) => category.level === "Strong" || category.level === "Good")
    .map((category) => `${category.title} is ${category.level.toLowerCase()} (${formatCategoryScore(category.score, category.maxPoints)}).`)

  const concerns = categories
    .filter((category) => category.level === "Low" || category.level === "Unknown")
    .map((category) =>
      category.level === "Unknown"
        ? `${category.title} still needs more verified information.`
        : `${category.title} is weaker (${formatCategoryScore(category.score, category.maxPoints)}).`,
    )

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
): OrganizationDetailExplanation {
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
  const objectiveScore = score.objectiveDonationWorthinessScore
  const personalizedScore = score.personalizedDonationWorthinessScore
  const listRankTier = getRankTierLabel(listObjectiveRank, rankingListSize)

  const categories = [
    explainGovernance(organization, score),
    explainAccountability(organization, score),
    explainImpactEvidence(organization, score),
    explainFinancialEfficiency(organization, score),
    explainPoliticalRisk(organization, score),
  ]

  const { strengths, concerns } = buildStrengthsAndConcerns(categories, score)

  const headline =
    listObjectiveRank === rankingListSize && rankingListSize > 1
      ? `Ranked #${listObjectiveRank} of ${rankingListSize} in ${rankingListLabel} — lowest in this list, but not necessarily a bad organization`
      : listObjectiveRank === 1
        ? `Ranked #1 of ${rankingListSize} in ${rankingListLabel}`
        : `Ranked #${listObjectiveRank} of ${rankingListSize} in ${rankingListLabel}`

  const overallSummary =
    score.redFlags.length > 0
      ? `${organization.organizationName} is ${listRankTier} within ${rankingListLabel}. The system found concerns that need manual review before giving more.`
      : score.rankingStatus === "Verified Ranking"
        ? `${organization.organizationName} is ${listRankTier} within ${rankingListLabel} with a verified score of ${objectiveScore} out of 100. This score is based on research, not on how much you have donated.`
        : `${organization.organizationName} is ${listRankTier} within ${rankingListLabel}, but the score of ${objectiveScore} is still preliminary because research is incomplete.`

  const rankExplanation =
    listObjectiveRank === listPersonalizedRank
      ? `Within ${rankingListLabel}, objective list rank #${listObjectiveRank} is based purely on research and evidence. Your personalized list rank is also #${listPersonalizedRank}${score.donorConfidenceAdjustment > 0 ? " — the small donor boost was not enough to move it up against stronger peers in this list" : ""}. Across all ${totalOrganizations} organizations, the global ranks are #${globalObjectiveRank} objective and #${globalPersonalizedRank} personalized.`
      : listPersonalizedRank < listObjectiveRank
        ? `Within ${rankingListLabel}, objective list rank is #${listObjectiveRank}. Your personalized list rank is #${listPersonalizedRank} because prior giving history added a small boost of +${score.donorConfidenceAdjustment} points. Global ranks across all organizations: #${globalObjectiveRank} objective, #${globalPersonalizedRank} personalized.`
        : `Within ${rankingListLabel}, objective list rank is #${listObjectiveRank}. Personalized list rank is #${listPersonalizedRank} after comparing against similar organizations you support. Global ranks across all organizations: #${globalObjectiveRank} objective, #${globalPersonalizedRank} personalized.`

  const personalizedRankExplanation =
    score.donorConfidenceAdjustment > 0
      ? `You currently give about $${Math.round(organization.approximateAnnualDonation)} per year. That history adds a small +${score.donorConfidenceAdjustment} point boost (personalized score ${personalizedScore}), acknowledging your prior confidence — but it does not override the evidence-based score of ${objectiveScore}.`
      : organization.approximateAnnualDonation > 0
        ? `You give about $${Math.round(organization.approximateAnnualDonation)} per year, but no donor boost was applied because the ranking is not fully verified yet or the boost was too small to change the score meaningfully.`
        : "No prior annual donation is recorded, so personalized rank matches the objective research-based rank."

  const donorHistoryExplanation = score.donationAmountAssessment

  const bottomLine =
    score.recommendation === "Priority Fund" || score.recommendation === "Keep"
      ? "Bottom line: this organization performs well on your key criteria and is a reasonable choice to keep supporting within its category list."
      : score.recommendation === "Pause / Do Not Fund"
        ? "Bottom line: pause this gift until the concerns below are resolved."
        : score.recommendation === "Reduce"
          ? "Bottom line: consider giving less here and moving more support toward higher-ranked organizations in this list."
          : listObjectiveRank === rankingListSize && rankingListSize > 1
            ? `Bottom line: this is the weakest fit in ${rankingListLabel}, but that does not mean it is a bad organization — it may still fit if you personally value its mission.`
            : "Bottom line: review the breakdown below and decide whether this organization still matches what you want your donations to accomplish."

  const missingDataNote =
    score.criticalMissingFields.length > 0
      ? `Some information is still missing (${score.criticalMissingFields.length} important fields). Best next step: ${score.strongestNextResearchStep}.`
      : score.missingFields.length > 0
        ? `Optional research still available: ${score.strongestNextResearchStep}.`
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
