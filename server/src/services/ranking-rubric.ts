import {
  ANIMAL_IMPACT_KEYWORDS,
  IDENTITY_CONFUSION_KEYWORDS,
  REVOKED_STATUS_KEYWORDS,
  RUBRIC_CATEGORY_MAX_POINTS,
} from "../config/ranking-rubric-config.js"
import { CHARITYWATCH_GRADE_SCORES } from "../config/watchdog-config.js"
import type { MissionBucket, Organization, SourceMeta } from "../types/organization.js"
import { getMissionBucket } from "./ranking-list-service.js"

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
}

function clampPoints(value: number, maxPoints: number): number {
  return Math.max(0, Math.min(value, maxPoints))
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

function hasMeasurableNumbers(text: string): boolean {
  if (/\$\s?\d[\d,]*(?:\.\d+)?(?:\s*(?:million|billion|thousand))?/i.test(text)) return true
  if (/\b\d[\d,]*(?:\.\d+)?\s*(?:%|percent)/i.test(text)) return true
  return /\b\d[\d,]*(?:\.\d+)?\s+(?:animals|dogs|cats|horses|acres|people|clients|patients|participants|adoptions|rescues|investigations|convictions|operations|states|countries|grants|projects|investigators|surgeries|transports|placements|volunteers|members|donors|meals|pounds|miles|hours|visits|calls|cases|laws|bills|veterans|teams|pairs|guides|puppies|kittens|birds|wildlife|sanctuaries|farms|ranches|facilities|centers|programs|services|events|trainings|workshops|sessions|classes|students|schools|communities|households|families|individuals|beneficiaries|recipients|supporters|partners|agencies|officers|employees|staff|lives|deaths|euthanasia|intakes|outcomes|inspections|seizures|arrests|prosecutions|filings|lawsuits|victories|wins|acres|hectares|species|populations|litters|herds|flocks|packs|colonies|liters|gallons|tons|units|beds|kennels|crates|vehicles|flights|trips|deliveries|distributions|donations|gifts|scholarships|awards|publications|reports|studies|trials|patents|discoveries|breakthroughs|therapies|treatments|procedures|screenings|tests|vaccinations|microchips|spays|neuters|sterilizations|vaccines|medications|prescriptions|referrals|consultations|counseling|sessions|graduates|graduations|deployments|matches|placements|graduates|graduations|handlers|trainers|graduates|teams|pairs|guides|puppies|kittens)\b/i.test(
    text,
  )
}

function isLikelyValidEin(ein: string): boolean {
  const digits = ein.replace(/\D/g, "")
  return digits.length === 9
}

export function scoreLegalIdentity(organization: Organization): LegalIdentityResult {
  const maxPoints = RUBRIC_CATEGORY_MAX_POINTS.governance
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

  if (hasWebsite) details.push("Public website helps confirm the organization is active.")
  if (hasIrsSource) details.push("IRS or ProPublica filing source supports legal identity.")
  if (identityConfusion) details.push("Notes mention possible alias or identity confusion.")

  let points = 4

  if (revokedStatus || (!validEin && !hasEin)) {
    points = 0
  } else if (validEin && has501c3 && hasWebsite && !identityConfusion && hasIrsSource) {
    points = 10
  } else if (validEin && has501c3 && !identityConfusion) {
    points = 10
  } else if (validEin && (has501c3 || hasWebsite || hasIrsSource) && !identityConfusion) {
    points = 7
  } else if (hasEin || hasWebsite || hasIrsSource) {
    points = 4
  } else {
    points = 0
  }

  if (organization.researchStatus === "failed") {
    points = Math.max(0, points - 2)
    details.push("Automated research failed to fully confirm identity.")
  }

  const unclearIdentity = !validEin || identityConfusion || (!has501c3 && !hasIrsSource && !hasWebsite)
  const revokedOrUnverified = revokedStatus || explicitlyNot501c3

  return {
    points: clampPoints(points, maxPoints),
    maxPoints,
    details,
    unclearIdentity,
    revokedOrUnverified,
    identityConfusion,
  }
}

export function scoreAccountability(organization: Organization): RubricCategoryResult {
  const maxPoints = RUBRIC_CATEGORY_MAX_POINTS.accountability
  const details: string[] = []
  let points = 0
  const sourceMeta = organization.sourceMeta ?? {}
  const accountabilityNotes = toSafeString(organization.accountabilityNotes).trim()
  const notes = normalizedNotes(organization)
  const hasWebsite = Boolean(toSafeString(organization.website).trim())

  if (hasWebsite) {
    points += 2
    details.push("Official website is on file.")
  }

  if (accountabilityNotes) {
    points += 4
    details.push("Accountability notes document public reporting.")
  }

  if (hasSourceType(sourceMeta, "propublica", "form 990", "990")) {
    points += 5
    details.push("Form 990 or ProPublica filing source is on file.")
  }

  if (hasRecentSource(sourceMeta)) {
    points += 3
    details.push("At least one research source was refreshed recently.")
  }

  if (notes.includes("annual report") || notes.includes("impact report")) {
    points += 4
    details.push("Annual or impact report reference found.")
  }

  if (notes.includes("board") || notes.includes("leadership") || notes.includes("director")) {
    points += 2
    details.push("Leadership or board information appears in research notes.")
  }

  if (notes.includes("program") || notes.includes("how donations") || notes.includes("donations are used")) {
    points += 2
    details.push("Program or donation-use description is documented.")
  }

  if (organization.charityNavigatorRating !== null) {
    points += 4
    details.push(`Charity Navigator rating: ${organization.charityNavigatorRating} stars.`)
  }

  if (organization.charityWatchGrade) {
    const gradeScore = CHARITYWATCH_GRADE_SCORES[organization.charityWatchGrade.toUpperCase()]
    points += gradeScore && gradeScore >= 84 ? 3 : 2
    details.push(`CharityWatch grade on file: ${organization.charityWatchGrade}.`)
  }

  if (organization.aceRecommendation) {
    points += 2
    details.push(`Animal Charity Evaluators status: ${organization.aceRecommendation}.`)
  }

  if (hasSourceType(sourceMeta, "candid", "guidestar")) {
    points += 2
    details.push("Candid/GuideStar source is on file.")
  }

  if (hasSourceType(sourceMeta, "bbb", "wise giving")) {
    points += 2
    details.push("BBB Wise Giving Alliance source is on file.")
  }

  if (Object.keys(sourceMeta).length >= 3) {
    points += 2
    details.push("Multiple independent sources support transparency.")
  }

  if (points <= 3) {
    details.push("Transparency evidence is still very limited.")
  } else if (points < 14) {
    details.push("Some accountability information exists, but important details are still missing.")
  }

  return {
    points: clampPoints(points, maxPoints),
    maxPoints,
    details,
  }
}

export function scoreImpactEvidence(organization: Organization): RubricCategoryResult {
  const maxPoints = RUBRIC_CATEGORY_MAX_POINTS.impactEvidence
  const details: string[] = []
  const impactNotes = toSafeString(organization.impactEvidenceNotes).trim()
  const notes = normalizedNotes(organization)
  const combinedImpactText = `${impactNotes} ${notes}`.toLowerCase()

  if (!impactNotes && !notes.includes("annual report") && !notes.includes("impact report")) {
    details.push("No documented impact evidence yet — mission alone does not earn a high impact score.")
    return { points: 0, maxPoints, details }
  }

  let points = 0

  if (impactNotes) {
    points += 6
    details.push("Impact notes are on file.")
  }

  const keywordMatches = countKeywordMatches(combinedImpactText, ANIMAL_IMPACT_KEYWORDS)
  if (keywordMatches >= 4) {
    points += 10
    details.push("Multiple specific animal-outcome themes are documented.")
  } else if (keywordMatches >= 2) {
    points += 6
    details.push("Some specific animal-outcome language is documented.")
  } else if (keywordMatches >= 1) {
    points += 3
    details.push("Limited specific outcome language was found.")
  }

  if (hasMeasurableNumbers(combinedImpactText)) {
    points += 8
    details.push("Measurable numbers or quantified outcomes appear in the evidence.")
  }

  if (
    notes.includes("annual report") ||
    notes.includes("impact report") ||
    impactNotes.toLowerCase().includes("report") ||
    impactNotes.toLowerCase().includes("form 990") ||
    impactNotes.toLowerCase().includes("part iii")
  ) {
    points += 4
    details.push("Impact or annual report reference supports the outcome claims.")
  }

  const vagueOnly =
    impactNotes.length > 0 &&
    keywordMatches === 0 &&
    !hasMeasurableNumbers(combinedImpactText) &&
    (combinedImpactText.includes("mission") || combinedImpactText.includes("help") || combinedImpactText.includes("support"))

  if (vagueOnly) {
    points = Math.min(points, 11)
    details.push("Impact language is mostly mission-focused rather than outcome-specific.")
  }

  if (points >= 24) {
    details.push("Strong, evidence-backed impact documentation.")
  } else if (points >= 12) {
    details.push("Good impact direction, but evidence is not fully quantified.")
  } else if (points >= 1) {
    details.push("Impact claims exist but remain weakly supported.")
  }

  return {
    points: clampPoints(points, maxPoints),
    maxPoints,
    details,
  }
}

function scoreRatioPoints(value: number, bands: Array<{ min?: number; max?: number; points: number }>): number {
  for (const band of bands) {
    const meetsMin = band.min === undefined || value >= band.min
    const meetsMax = band.max === undefined || value <= band.max
    if (meetsMin && meetsMax) return band.points
  }
  return 0
}

export function scoreFinancialEfficiency(organization: Organization): FinancialRubricResult {
  const maxPoints = RUBRIC_CATEGORY_MAX_POINTS.financialEfficiency
  const details: string[] = []
  const sourceMeta = organization.sourceMeta ?? {}
  const hasAllRatios =
    organization.programPercent !== null &&
    organization.fundraisingPercent !== null &&
    organization.adminPercent !== null

  if (!hasAllRatios && organization.programPercent === null && organization.fundraisingPercent === null && organization.adminPercent === null) {
    return {
      points: 0,
      maxPoints,
      details: ["Program, fundraising, and admin percentages are not verified yet."],
      status: "unknown",
      warning: "Financials missing — needs Form 990 or charity rating source.",
      staleData: false,
    }
  }

  let points = 0
  let ratioCount = 0

  if (organization.programPercent !== null) {
    ratioCount += 1
    points += scoreRatioPoints(organization.programPercent, [
      { min: 85, points: 8 },
      { min: 75, points: 6 },
      { min: 65, points: 4 },
      { min: 0, points: 2 },
    ])
    details.push(`Program spending: ${organization.programPercent}%.`)
  }

  if (organization.fundraisingPercent !== null) {
    ratioCount += 1
    points += scoreRatioPoints(organization.fundraisingPercent, [
      { max: 12, points: 8 },
      { max: 20, points: 6 },
      { max: 30, points: 4 },
      { max: 100, points: 2 },
    ])
    details.push(`Fundraising cost: ${organization.fundraisingPercent}%.`)
  }

  if (organization.adminPercent !== null) {
    ratioCount += 1
    points += scoreRatioPoints(organization.adminPercent, [
      { max: 10, points: 8 },
      { max: 15, points: 6 },
      { max: 20, points: 4 },
      { max: 100, points: 2 },
    ])
    details.push(`Administration cost: ${organization.adminPercent}%.`)
  }

  if (ratioCount === 3) {
    points += 4
    details.push("Full program, fundraising, and admin ratios are available.")
  } else {
    points = Math.min(points, 18)
    details.push("Financial picture is incomplete because one or more ratios are missing.")
  }

  if (hasSourceType(sourceMeta, "propublica", "form 990", "990", "charity navigator")) {
    points += 3
    details.push("Financial ratios are supported by a filing or watchdog source.")
  }

  const staleData = Object.keys(sourceMeta).length > 0 && !hasRecentSource(sourceMeta, 36)
  if (staleData) {
    points = Math.max(0, points - 4)
    details.push("Financial source data may be stale — confidence is reduced.")
  }

  if (ratioCount < 3) {
    return {
      points: clampPoints(points, maxPoints),
      maxPoints,
      details,
      status: "unknown",
      warning: "Financial efficiency is limited because verified ratios are incomplete.",
      staleData,
    }
  }

  return {
    points: clampPoints(points, maxPoints),
    maxPoints,
    details,
    status: "known",
    warning: staleData ? "Financial ratios exist but source data may be outdated." : null,
    staleData,
  }
}

export function scorePoliticalRisk(organization: Organization, missionBucket?: MissionBucket): RubricCategoryResult {
  const maxPoints = RUBRIC_CATEGORY_MAX_POINTS.politicalRisk
  const details: string[] = []
  const politicalNotes = toSafeString(organization.politicalInvolvementNotes).trim()
  const notes = `${politicalNotes} ${toSafeString(organization.notes)}`.toLowerCase()
  const resolvedMissionBucket = missionBucket ?? getMissionBucket(organization.category, organization.subcategory)
  const isLegalAdvocacy =
    organization.category.toLowerCase().includes("legal") ||
    organization.subcategory.toLowerCase().includes("legal") ||
    resolvedMissionBucket === "Animal Legal Advocacy"

  let points = 4

  if (politicalNotes) {
    points += 1
    details.push("Political or advocacy involvement is documented.")
  } else {
    points -= 1
    details.push("Political or advocacy notes are not recorded yet.")
  }

  if (notes.includes("nonpartisan") || notes.includes("low political") || notes.includes("minimal advocacy")) {
    points += 1
    details.push("Notes suggest limited or nonpartisan political involvement.")
  }

  if (notes.includes("lobby") || notes.includes("campaign") || notes.includes("ballot")) {
    if (isLegalAdvocacy) {
      details.push("Advocacy or policy work is expected for this legal/advocacy mission type.")
    } else {
      points -= 1
      details.push("Notes mention lobbying, campaign, or ballot activity — review donor comfort.")
    }
  }

  if (notes.includes("unclear") || notes.includes("unknown political")) {
    points -= 2
    details.push("Political or advocacy role is unclear and needs donor review.")
  }

  if (notes.includes("high political") || notes.includes("major political")) {
    points -= 2
    details.push("Notes suggest higher political involvement than typical direct-service charities.")
  }

  if (isLegalAdvocacy && politicalNotes && !notes.includes("unclear")) {
    points = Math.max(points, 3)
    details.push("Legal advocacy organizations are scored for transparency, not penalized for policy work alone.")
  }

  return {
    points: clampPoints(points, maxPoints),
    maxPoints,
    details,
  }
}

export function calculateRubricTotal(
  governance: LegalIdentityResult,
  accountability: RubricCategoryResult,
  impact: RubricCategoryResult,
  financial: FinancialRubricResult,
  political: RubricCategoryResult,
): { earnedPoints: number; maxPoints: number; preliminaryScore: number } {
  const earnedPoints =
    governance.points + accountability.points + impact.points + political.points + (financial.status === "known" ? financial.points : 0)

  const maxPoints =
    governance.maxPoints +
    accountability.maxPoints +
    impact.maxPoints +
    political.maxPoints +
    (financial.status === "known" ? financial.maxPoints : 0)

  const preliminaryScore = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 1000) / 10 : 0

  return { earnedPoints, maxPoints, preliminaryScore }
}
