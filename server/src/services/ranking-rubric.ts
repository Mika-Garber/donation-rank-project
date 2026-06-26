import {
  ANIMAL_IMPACT_KEYWORDS,
  IDENTITY_CONFUSION_KEYWORDS,
  REVOKED_STATUS_KEYWORDS,
  RUBRIC_CATEGORY_MAX_POINTS,
} from "../config/ranking-rubric-config.js"
import { MISSION_FIT_DEFAULT_SCORE, STEWARDSHIP_WEIGHTS } from "../config/ranking-config.js"
import type { LegalVerificationStatus, MissionBucket, Organization, SourceMeta } from "../types/organization.js"
import { getMissionBucket } from "./ranking-list-service.js"
import {
  countQuantifiedOutcomesFromText,
  detectImpactDataYear,
  detectImpactSourceTier,
  impactSourceTierPoints,
} from "./impact-metadata-service.js"

export interface RubricCategoryResult {
  points: number
  maxPoints: number
  details: string[]
}

export interface LegalIdentityResult extends RubricCategoryResult {
  unclearIdentity: boolean
  revokedOrUnverified: boolean
  identityConfusion: boolean
}

export interface FinancialRubricResult extends RubricCategoryResult {
  status: "known" | "unknown"
  warning: string | null
  staleData: boolean
  completeness: "complete" | "partial" | "missing"
}

export interface AccountabilityRubricResult extends RubricCategoryResult {
  watchdogReviewRequired: boolean
}

export interface StewardshipTotalResult {
  stewardshipScore: number
  financialIncluded: boolean
  financialCompleteness: "complete" | "partial" | "missing"
}

const CATEGORY_MAX = 100

function clampScore(value: number): number {
  return Math.max(0, Math.min(Math.round(value * 10) / 10, CATEGORY_MAX))
}

function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return String(value)
}

function normalizedNotes(organization: Organization): string {
  return `${toSafeString(organization.notes)} ${toSafeString(organization.accountabilityNotes)} ${toSafeString(organization.impactEvidenceNotes)}`.toLowerCase()
}

function hasSourceType(sourceMeta: Record<string, SourceMeta>, ...keywords: string[]): boolean {
  return Object.values(sourceMeta).some((source) => {
    const haystack = `${source.sourceType ?? ""} ${source.sourceName}`.toLowerCase()
    return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
  })
}

function hasRecentSource(sourceMeta: Record<string, SourceMeta>, months = 24): boolean {
  const cutoff = Date.now() - months * 30 * 24 * 60 * 60 * 1000
  return Object.values(sourceMeta).some((source) => {
    const fetchedAt = Date.parse(source.fetchedAt)
    return Number.isFinite(fetchedAt) && fetchedAt >= cutoff
  })
}

function countKeywordMatches(text: string, keywords: readonly string[]): number {
  return keywords.filter((keyword) => text.includes(keyword)).length
}

function scoreImpactRecency(dataYear: number | null): number {
  if (dataYear === null) return 3
  const age = new Date().getFullYear() - dataYear
  if (age <= 1) return 10
  if (age <= 2) return 7
  if (age <= 4) return 4
  return 1
}

function isLikelyValidEin(ein: string): boolean {
  const digits = ein.replace(/\D/g, "")
  return digits.length === 9
}

function scoreProgramPercent(value: number): number {
  if (value >= 90) return 40
  if (value >= 85) return 36
  if (value >= 80) return 32
  if (value >= 75) return 28
  if (value >= 70) return 22
  if (value >= 65) return 16
  if (value >= 55) return 10
  return 4
}

function scoreFundraisingPercent(value: number): number {
  if (value <= 8) return 30
  if (value <= 12) return 26
  if (value <= 15) return 22
  if (value <= 20) return 16
  if (value <= 25) return 10
  if (value <= 35) return 6
  return 2
}

function scoreAdminPercent(value: number): number {
  if (value <= 8) return 20
  if (value <= 10) return 17
  if (value <= 12) return 14
  if (value <= 15) return 10
  if (value <= 18) return 7
  if (value <= 25) return 4
  return 2
}

function normalizeCharityWatchGrade(grade: string): string {
  return grade.trim().toUpperCase()
}

function getCharityWatchAccountabilityAdjustment(grade: string): { points: number; reviewRequired: boolean; detail: string } {
  const normalized = normalizeCharityWatchGrade(grade)
  if (normalized === "A+" || normalized === "A") {
    return { points: 10, reviewRequired: false, detail: `CharityWatch grade ${grade} supports accountability confidence.` }
  }
  if (normalized === "B+" || normalized === "B") {
    return { points: 7, reviewRequired: false, detail: `CharityWatch grade ${grade} supports accountability confidence.` }
  }
  if (normalized === "C+" || normalized === "C") {
    return { points: 0, reviewRequired: true, detail: `CharityWatch grade ${grade} is neutral and warrants review.` }
  }
  if (normalized === "D" || normalized === "F") {
    return {
      points: -15,
      reviewRequired: true,
      detail: `CharityWatch grade ${grade} is poor and triggers watchdog review.`,
    }
  }
  return { points: 0, reviewRequired: false, detail: `CharityWatch grade ${grade} is on file.` }
}

function getCharityNavigatorAccountabilityAdjustment(rating: number): { points: number; reviewRequired: boolean; detail: string } {
  if (rating >= 4) {
    return { points: 14, reviewRequired: false, detail: `Charity Navigator rating: ${rating} stars.` }
  }
  if (rating >= 3) {
    return { points: 10, reviewRequired: false, detail: `Charity Navigator rating: ${rating} stars.` }
  }
  if (rating === 2) {
    return {
      points: -8,
      reviewRequired: true,
      detail: `Charity Navigator rating: ${rating} stars — below average and warrants review.`,
    }
  }
  return {
    points: -14,
    reviewRequired: true,
    detail: `Charity Navigator rating: ${rating} stars — poor watchdog signal.`,
  }
}

export function deriveLegalVerificationStatus(
  organization: Organization,
  legalIdentity: LegalIdentityResult,
  hasAnyResearch: boolean,
  missingCoreFields: string[],
): LegalVerificationStatus {
  if (legalIdentity.revokedOrUnverified) return "Failed Verification"

  const hasEin = Boolean(toSafeString(organization.ein).trim())
  const verified501 = toSafeString(organization.is501c3Verified).trim().toLowerCase() === "y"

  if (!hasAnyResearch && missingCoreFields.length >= 3 && !hasEin) {
    return "Insufficient Data"
  }

  if (legalIdentity.unclearIdentity || missingCoreFields.length > 0 || !verified501 || !hasEin) {
    return "Needs Review"
  }

  if (legalIdentity.identityConfusion) {
    return "Needs Review"
  }

  return "Verified"
}

export function scoreStewardshipGovernance(organization: Organization, legalIdentity: LegalIdentityResult): RubricCategoryResult {
  const details: string[] = []
  const sourceMeta = organization.sourceMeta ?? {}
  const hasWebsite = Boolean(toSafeString(organization.website).trim())
  const hasIrsSource = hasSourceType(sourceMeta, "irs", "propublica", "form 990")
  let points = 40

  if (hasIrsSource) {
    points += 22
    details.push("IRS or ProPublica filing source supports governance hygiene.")
  }
  if (hasWebsite) {
    points += 12
    details.push("Public website helps confirm the organization is active.")
  }
  if (!legalIdentity.identityConfusion) {
    points += 16
    details.push("No alias or identity confusion was noted.")
  } else {
    points -= 18
    details.push("Possible alias or identity confusion lowers governance hygiene.")
  }
  if (organization.researchStatus === "complete") {
    points += 10
  } else if (organization.researchStatus === "partial") {
    points += 4
  }
  if (organization.researchStatus === "failed") {
    points -= 12
    details.push("Automated research failed to fully confirm governance details.")
  }
  if (hasRecentSource(sourceMeta)) {
    points += 6
    details.push("At least one research source was refreshed recently.")
  }

  return {
    points: clampScore(points),
    maxPoints: RUBRIC_CATEGORY_MAX_POINTS.governance,
    details,
  }
}

export function scoreMissionFit(organization: Organization): RubricCategoryResult {
  const details: string[] = []
  let points: number = MISSION_FIT_DEFAULT_SCORE
  const role = organization.duplicateMissionRole

  if (role === "primary") {
    points = 90
    details.push("Marked as a primary organization within its mission overlap group.")
  } else if (role === "secondary") {
    points = 75
    details.push("Marked as a secondary organization within its mission overlap group.")
  } else if (role === "phasing-out") {
    points = 50
    details.push("Marked as phasing out within its mission overlap group.")
  } else {
    details.push("No explicit mission-fit role assigned — using neutral default.")
  }

  if (organization.subcategory && organization.subcategory.trim() && organization.subcategory !== "General") {
    points = Math.min(100, points + 5)
    details.push(`Subcategory "${organization.subcategory}" provides clearer mission-bucket fit.`)
  }

  if (organization.duplicateMission.trim()) {
    details.push("Duplicate-mission flag is recorded for portfolio review.")
  }

  return {
    points: clampScore(points),
    maxPoints: 100,
    details,
  }
}

export function scoreLegalIdentity(organization: Organization): LegalIdentityResult {
  const details: string[] = []
  const ein = toSafeString(organization.ein).trim()
  const verified = toSafeString(organization.is501c3Verified).trim().toLowerCase()
  const notes = normalizedNotes(organization)
  const sourceMeta = organization.sourceMeta ?? {}

  const hasEin = Boolean(ein)
  const validEin = hasEin && isLikelyValidEin(ein)
  const has501c3 = verified === "y"
  const explicitlyNot501c3 = verified === "n" || verified === "no" || verified === "revoked"
  const hasWebsite = Boolean(toSafeString(organization.website).trim())
  const hasIrsSource = hasSourceType(sourceMeta, "irs", "propublica", "form 990")
  const identityConfusion = IDENTITY_CONFUSION_KEYWORDS.some((keyword) => notes.includes(keyword))
  const revokedStatus = REVOKED_STATUS_KEYWORDS.some((keyword) => notes.includes(keyword)) || explicitlyNot501c3

  if (hasEin) details.push(`EIN on file: ${ein}.`)
  else details.push("No reliable EIN on file.")
  if (has501c3) details.push("501(c)(3) status is verified.")
  else if (explicitlyNot501c3 || revokedStatus) details.push("501(c)(3) status is not verified or appears revoked.")
  else details.push("501(c)(3) status still needs confirmation.")

  let points = 0

  if (revokedStatus || (!validEin && !hasEin)) {
    points = 0
  } else {
    if (validEin) points += 22
    else if (hasEin) points += 10

    if (has501c3) points += 25
    else if (!explicitlyNot501c3) points += 8

    if (hasIrsSource) points += 20
    if (hasWebsite) points += 12
    if (!identityConfusion) points += 12
    else points -= 15

    if (organization.researchStatus === "complete") points += 9
    else if (organization.researchStatus === "partial") points += 4
    if (organization.researchStatus === "failed") {
      points -= 12
      details.push("Automated research failed to fully confirm identity.")
    }
  }

  if (identityConfusion) details.push("Notes mention possible alias or identity confusion.")
  if (hasWebsite) details.push("Public website helps confirm the organization is active.")
  if (hasIrsSource) details.push("IRS or ProPublica filing source supports legal identity.")

  const unclearIdentity = !validEin || identityConfusion || (!has501c3 && !hasIrsSource && !hasWebsite)
  const revokedOrUnverified = revokedStatus || explicitlyNot501c3

  return {
    points: clampScore(points),
    maxPoints: RUBRIC_CATEGORY_MAX_POINTS.governance,
    details,
    unclearIdentity,
    revokedOrUnverified,
    identityConfusion,
  }
}

export function scoreAccountability(organization: Organization): AccountabilityRubricResult {
  const details: string[] = []
  let points = 0
  let watchdogReviewRequired = false
  const sourceMeta = organization.sourceMeta ?? {}
  const accountabilityNotes = toSafeString(organization.accountabilityNotes).trim()
  const notes = normalizedNotes(organization)
  const hasWebsite = Boolean(toSafeString(organization.website).trim())

  if (hasWebsite) {
    points += 8
    details.push("Official website is on file.")
  }

  if (accountabilityNotes) {
    points += 10
    details.push("Accountability notes document public reporting.")
  }

  if (hasSourceType(sourceMeta, "propublica", "form 990", "990")) {
    points += 16
    details.push("Form 990 or ProPublica filing source is on file.")
  }

  if (hasRecentSource(sourceMeta)) {
    points += 8
    details.push("At least one research source was refreshed recently.")
  }

  if (notes.includes("annual report pdf")) {
    points += 10
    details.push("Uploaded annual or impact report PDF is on file.")
  } else if (notes.includes("annual report") || notes.includes("impact report")) {
    points += 6
    details.push("Annual or impact report reference found.")
  }

  if (notes.includes("board") || notes.includes("leadership") || notes.includes("director")) {
    points += 6
    details.push("Leadership or board information appears in research notes.")
  }

  if (notes.includes("program") || notes.includes("how donations") || notes.includes("donations are used")) {
    points += 6
    details.push("Program or donation-use description is documented.")
  }

  if (organization.charityNavigatorRating !== null) {
    const cnAdjustment = getCharityNavigatorAccountabilityAdjustment(organization.charityNavigatorRating)
    points += cnAdjustment.points
    watchdogReviewRequired = watchdogReviewRequired || cnAdjustment.reviewRequired
    details.push(cnAdjustment.detail)
  }

  if (organization.charityWatchGrade) {
    const cwAdjustment = getCharityWatchAccountabilityAdjustment(organization.charityWatchGrade)
    points += cwAdjustment.points
    watchdogReviewRequired = watchdogReviewRequired || cwAdjustment.reviewRequired
    details.push(cwAdjustment.detail)
  }

  if (organization.aceRecommendation) {
    points += 8
    details.push(`Animal Charity Evaluators status: ${organization.aceRecommendation}.`)
  }

  if (hasSourceType(sourceMeta, "candid", "guidestar")) {
    points += 5
    details.push("Candid/GuideStar source is on file.")
  }

  if (hasSourceType(sourceMeta, "bbb", "wise giving")) {
    points += 5
    details.push("BBB Wise Giving Alliance source is on file.")
  }

  const sourceCount = Object.keys(sourceMeta).length
  if (sourceCount >= 5) {
    points += 8
    details.push("Many independent sources support transparency.")
  } else if (sourceCount >= 3) {
    points += 4
    details.push("Multiple independent sources support transparency.")
  }

  if (points < 30) {
    details.push("Transparency evidence is still very limited.")
  } else if (points < 60) {
    details.push("Some accountability information exists, but important details are still missing.")
  } else if (points >= 85) {
    details.push("Strong accountability and transparency documentation.")
  }

  return {
    points: clampScore(points),
    maxPoints: RUBRIC_CATEGORY_MAX_POINTS.accountability,
    details,
    watchdogReviewRequired,
  }
}

export function scoreImpactEvidence(organization: Organization): RubricCategoryResult {
  const details: string[] = []
  const impactNotes = toSafeString(organization.impactEvidenceNotes).trim()
  const notes = normalizedNotes(organization)
  const combinedImpactText = `${impactNotes} ${notes}`.toLowerCase()

  if (!impactNotes && !notes.includes("annual report") && !notes.includes("impact report")) {
    details.push("No documented impact evidence yet — mission alone does not earn a high impact score.")
    return { points: 0, maxPoints: RUBRIC_CATEGORY_MAX_POINTS.impactEvidence, details }
  }

  let points = 0

  const outcomeCount = Math.max(
    organization.quantifiedOutcomeCount ?? 0,
    countQuantifiedOutcomesFromText(combinedImpactText),
  )
  if (outcomeCount >= 8) {
    points += 25
    details.push(`${outcomeCount} distinct quantified outcomes documented.`)
  } else if (outcomeCount >= 5) {
    points += 20
    details.push(`${outcomeCount} quantified outcomes documented.`)
  } else if (outcomeCount >= 3) {
    points += 14
    details.push(`${outcomeCount} quantified outcomes documented.`)
  } else if (outcomeCount >= 1) {
    points += 8
    details.push("Limited quantified outcomes found.")
  }

  const keywordMatches = countKeywordMatches(combinedImpactText, ANIMAL_IMPACT_KEYWORDS)
  if (keywordMatches >= 5) {
    points += 18
    details.push("Multiple specific animal-outcome themes are documented.")
  } else if (keywordMatches >= 3) {
    points += 12
    details.push("Several specific animal-outcome themes are documented.")
  } else if (keywordMatches >= 1) {
    points += 6
    details.push("Limited specific outcome language was found.")
  }

  const sourceTierKey = detectImpactSourceTier(organization)
  let sourceTier = impactSourceTierPoints(sourceTierKey)
  const hasStrongForm990Evidence =
    sourceTierKey === "form_990" &&
    (outcomeCount >= 3 || combinedImpactText.includes("key quantified outcomes"))
  if (hasStrongForm990Evidence) {
    sourceTier = Math.max(sourceTier, 12)
  }
  points += sourceTier
  if (sourceTier >= 20) details.push("High-quality impact source (annual report or evaluator).")
  else if (sourceTier >= 12 && hasStrongForm990Evidence) {
    details.push("Strong Form 990 Part III outcomes documented with quantified results.")
  } else if (sourceTier >= 12) details.push("Website impact research supports outcome claims.")
  else if (sourceTier >= 10) details.push("Cause IQ profile adds structured program and funding context beyond raw 990 text.")
  else if (sourceTier >= 8) details.push("Impact evidence is primarily from Form 990 filings.")
  else details.push("Impact notes exist but source quality is limited.")

  const dataYear = organization.impactDataYear ?? detectImpactDataYear(combinedImpactText)
  const recencyPoints = scoreImpactRecency(dataYear)
  points += recencyPoints
  if (recencyPoints >= 7) details.push("Impact data appears recent.")
  else if (recencyPoints <= 3) details.push("Impact data may be outdated.")

  const vagueOnly =
    impactNotes.length > 0 &&
    outcomeCount === 0 &&
    keywordMatches === 0 &&
    (combinedImpactText.includes("mission") || combinedImpactText.includes("help") || combinedImpactText.includes("support"))

  if (vagueOnly) {
    points = Math.min(points, 35)
    details.push("Impact language is mostly mission-focused rather than outcome-specific.")
  }

  if (
    sourceTierKey === "form_990" &&
    impactNotes.length >= 150 &&
    keywordMatches >= 1 &&
    points < 26
  ) {
    points = 26
    details.push("Form 990 program description documents meaningful animal welfare work.")
  }

  if (points >= 80) {
    details.push("Strong, evidence-backed impact documentation.")
  } else if (points >= 55) {
    details.push("Good impact direction, but evidence is not as strong as top-ranked organizations.")
  } else if (points >= 25) {
    details.push("Impact claims exist but remain weakly supported.")
  }

  return {
    points: clampScore(points),
    maxPoints: RUBRIC_CATEGORY_MAX_POINTS.impactEvidence,
    details,
  }
}

export function scoreFinancialEfficiency(organization: Organization): FinancialRubricResult {
  const details: string[] = []
  const sourceMeta = organization.sourceMeta ?? {}
  const hasAllRatios =
    organization.programPercent !== null &&
    organization.fundraisingPercent !== null &&
    organization.adminPercent !== null

  if (!hasAllRatios && organization.programPercent === null && organization.fundraisingPercent === null && organization.adminPercent === null) {
    return {
      points: 0,
      maxPoints: RUBRIC_CATEGORY_MAX_POINTS.financialEfficiency,
      details: ["Program, fundraising, and admin percentages are not verified yet."],
      status: "unknown",
      warning: "Financials missing — needs Form 990 or charity rating source.",
      staleData: false,
      completeness: "missing",
    }
  }

  let points = 0
  let ratioCount = 0

  if (organization.programPercent !== null) {
    ratioCount += 1
    points += scoreProgramPercent(organization.programPercent)
    details.push(`Program spending: ${organization.programPercent}%.`)
  }

  if (organization.fundraisingPercent !== null) {
    ratioCount += 1
    points += scoreFundraisingPercent(organization.fundraisingPercent)
    details.push(`Fundraising cost: ${organization.fundraisingPercent}%.`)
  }

  if (organization.adminPercent !== null) {
    ratioCount += 1
    points += scoreAdminPercent(organization.adminPercent)
    details.push(`Administration cost: ${organization.adminPercent}%.`)
  }

  if (ratioCount === 3) {
    points += 8
    details.push("Full program, fundraising, and admin ratios are available.")
  } else {
    points = Math.min(points, 55)
    details.push("Financial picture is incomplete because one or more ratios are missing.")
  }

  if (hasSourceType(sourceMeta, "propublica", "form 990", "990", "charity navigator")) {
    points += 4
    details.push("Financial ratios are supported by a filing or watchdog source.")
  }

  const staleData = Object.keys(sourceMeta).length > 0 && !hasRecentSource(sourceMeta, 36)
  if (staleData) {
    points = Math.max(0, points - 8)
    details.push("Financial source data may be stale — confidence is reduced.")
  }

  if (ratioCount < 3) {
    return {
      points: clampScore(points),
      maxPoints: RUBRIC_CATEGORY_MAX_POINTS.financialEfficiency,
      details,
      status: "unknown",
      warning: "Financial efficiency is limited because verified ratios are incomplete.",
      staleData,
      completeness: "partial",
    }
  }

  return {
    points: clampScore(points),
    maxPoints: RUBRIC_CATEGORY_MAX_POINTS.financialEfficiency,
    details,
    status: "known",
    warning: staleData ? "Financial ratios exist but source data may be outdated." : null,
    staleData,
    completeness: "complete",
  }
}

export function scorePoliticalRisk(organization: Organization, missionBucket?: MissionBucket): RubricCategoryResult {
  const details: string[] = []
  const politicalNotes = toSafeString(organization.politicalInvolvementNotes).trim()
  const notes = `${politicalNotes} ${toSafeString(organization.notes)}`.toLowerCase()
  const resolvedMissionBucket = missionBucket ?? getMissionBucket(organization.category, organization.subcategory)
  const isLegalAdvocacy =
    organization.category.toLowerCase().includes("legal") ||
    organization.subcategory.toLowerCase().includes("legal") ||
    resolvedMissionBucket === "Animal Legal Advocacy"

  let points = 55

  if (politicalNotes) {
    points += 18
    details.push("Political or advocacy involvement is documented.")
  } else {
    points -= 12
    details.push("Political or advocacy notes are not recorded yet.")
  }

  if (notes.includes("nonpartisan") || notes.includes("low political") || notes.includes("minimal advocacy")) {
    points += 12
    details.push("Notes suggest limited or nonpartisan political involvement.")
  }

  if (notes.includes("lobby") || notes.includes("campaign") || notes.includes("ballot")) {
    if (isLegalAdvocacy) {
      points += 8
      details.push("Advocacy or policy work is expected for this legal/advocacy mission type.")
    } else {
      points -= 12
      details.push("Notes mention lobbying, campaign, or ballot activity — review donor comfort.")
    }
  }

  if (notes.includes("unclear") || notes.includes("unknown political")) {
    points -= 18
    details.push("Political or advocacy role is unclear and needs donor review.")
  }

  if (notes.includes("high political") || notes.includes("major political")) {
    points -= 20
    details.push("Notes suggest higher political involvement than typical direct-service charities.")
  }

  if (isLegalAdvocacy && politicalNotes && !notes.includes("unclear")) {
    points = Math.max(points, 62)
    details.push("Legal advocacy organizations are scored for transparency, not penalized for policy work alone.")
  }

  return {
    points: clampScore(points),
    maxPoints: RUBRIC_CATEGORY_MAX_POINTS.politicalRisk,
    details,
  }
}

export function calculateStewardshipTotal(
  financial: FinancialRubricResult,
  accountability: RubricCategoryResult,
  governance: RubricCategoryResult,
  missionFit: RubricCategoryResult,
): StewardshipTotalResult {
  const financialIncluded = financial.status === "known" && financial.completeness === "complete"

  if (financialIncluded) {
    const stewardshipScore =
      (financial.points * STEWARDSHIP_WEIGHTS.financialEfficiency) / 100 +
      (accountability.points * STEWARDSHIP_WEIGHTS.accountability) / 100 +
      (governance.points * STEWARDSHIP_WEIGHTS.governance) / 100 +
      (missionFit.points * STEWARDSHIP_WEIGHTS.missionFit) / 100

    return {
      stewardshipScore: Math.round(stewardshipScore * 10) / 10,
      financialIncluded: true,
      financialCompleteness: "complete",
    }
  }

  const remainingWeight =
    STEWARDSHIP_WEIGHTS.accountability + STEWARDSHIP_WEIGHTS.governance + STEWARDSHIP_WEIGHTS.missionFit
  const stewardshipScore =
    (accountability.points * STEWARDSHIP_WEIGHTS.accountability) / remainingWeight +
    (governance.points * STEWARDSHIP_WEIGHTS.governance) / remainingWeight +
    (missionFit.points * STEWARDSHIP_WEIGHTS.missionFit) / remainingWeight

  return {
    stewardshipScore: Math.round(stewardshipScore * 10) / 10,
    financialIncluded: false,
    financialCompleteness: financial.completeness,
  }
}
