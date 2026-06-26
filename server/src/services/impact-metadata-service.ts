import type { ImpactEvidenceLevel, ImpactSourceTier, Organization } from "../types/organization.js"

const OUTCOME_PATTERNS = [
  /\b\d[\d,]*(?:\.\d+)?\s+(?:animals|dogs|cats|horses|adoptions|adopted|rescues|rescued|lives|people|veterans|surgeries|transports|placements|investigations|states|countries|acres|meals|volunteers|members|donors|grants|programs|facilities|elephants|cases|lawsuits|victories|clients|patients|participants|families|individuals|sessions|users|referrals|deployments|shelters|wildlife|scientists|partners|beneficiaries|senior dogs|k9s|k9)\b/gi,
  /\$\s?\d[\d,]{3,}/g,
  /\b\d[\d,]*\s*(?:%|percent)\b/gi,
  /\bover\s+\d[\d,]+\b/gi,
  /\b\d[\d,]+\+\s+\w+/g,
]

const LARGE_OUTCOME_UNITS =
  /\b([\d,]+)\s+(?:animals|dogs|cats|adoptions|rescues|lives|people|veterans|individuals|clients|patients|beneficiaries|volunteers|members|donors|surgeries|transports|placements|investigations|states|countries|grants|programs|facilities|meals|hours|visits|calls|cases|events|trainings|sessions|students|households|families|senior dogs|k9s|k9)\b/gi

const LARGE_OUTCOME_OVER =
  /\b(?:over|more than|saved over|helped over|served over|rescued over)\s+([\d,]+)\s+(?:animals|dogs|cats|adoptions|rescues|lives|people|veterans|individuals|clients|patients|beneficiaries|volunteers|members|donors|surgeries|transports|placements|investigations|states|countries|grants|programs|facilities|meals|hours|visits|calls|cases|events|trainings|sessions|students|households|families|senior dogs|k9s|k9)\b/gi

function applyLargeOutcomeBoost(text: string, effective: number): number {
  let boosted = effective
  for (const pattern of [LARGE_OUTCOME_UNITS, LARGE_OUTCOME_OVER]) {
    for (const match of text.matchAll(pattern)) {
      const value = Number.parseInt(match[1].replace(/,/g, ""), 10)
      if (!Number.isFinite(value)) continue
      if (value >= 50_000) boosted = Math.max(boosted, 8)
      else if (value >= 10_000) boosted = Math.max(boosted, 6)
      else if (value >= 1_000) boosted = Math.max(boosted, 4)
      else if (value >= 100) boosted = Math.max(boosted, 3)
    }
  }
  return boosted
}

const RATE_LIMIT_MARKERS = [
  "reached your limit of 100 profile views",
  "want access to more profiles",
  "create a free cause iq account",
]

function hasValidCauseIqEvidence(impactNotesLower: string): boolean {
  if (RATE_LIMIT_MARKERS.some((marker) => impactNotesLower.includes(marker))) {
    return false
  }
  const marker = "cause iq profile research"
  const markerIndex = impactNotesLower.indexOf(marker)
  if (markerIndex < 0) {
    return false
  }
  const body = impactNotesLower.slice(markerIndex + marker.length)
  return body.trim().length > 80
}

function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return String(value)
}

export function countQuantifiedOutcomesFromText(text: string): number {
  const matches = new Set<string>()
  for (const pattern of OUTCOME_PATTERNS) {
    for (const match of text.match(pattern) ?? []) {
      matches.add(match.toLowerCase())
    }
  }

  const keySection = text.match(/key quantified outcomes:\s*([^.]+)/i)
  if (keySection) {
    for (const part of keySection[1].split(";")) {
      const trimmed = part.trim()
      if (/\d/.test(trimmed) && trimmed.length >= 3) {
        matches.add(trimmed.toLowerCase())
      }
    }
  }

  let effective = applyLargeOutcomeBoost(text, matches.size)

  return effective
}

export function detectImpactDataYear(text: string): number | null {
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]))
  if (years.length === 0) return null
  return Math.max(...years)
}

export function detectImpactSourceTier(organization: Organization): ImpactSourceTier {
  if (organization.aceRecommendation) return "evaluator"

  const impactNotes = toSafeString(organization.impactEvidenceNotes).toLowerCase()
  const notes = `${impactNotes} ${toSafeString(organization.notes).toLowerCase()}`
  const sourceMeta = organization.sourceMeta ?? {}

  if (impactNotes.includes("annual report pdf")) return "annual_report_pdf"

  const metaHaystack = Object.values(sourceMeta)
    .map((source) => `${source.sourceType ?? ""} ${source.sourceName}`.toLowerCase())
    .join(" ")
  if (metaHaystack.includes("animal charity evaluators") || metaHaystack.includes("ace")) return "evaluator"
  if (hasValidCauseIqEvidence(impactNotes)) {
    return "cause_iq"
  }
  if (impactNotes.includes("website impact research") || notes.includes("website annual/impact report link")) {
    return "website"
  }
  if (
    impactNotes.includes("form 990") ||
    impactNotes.includes("part iii") ||
    metaHaystack.includes("irs e-file") ||
    metaHaystack.includes("propublica") ||
    metaHaystack.includes("form 990")
  ) {
    return "form_990"
  }
  if (impactNotes.trim()) return "website"
  return "none"
}

export function impactSourceTierPoints(tier: ImpactSourceTier): number {
  switch (tier) {
    case "evaluator":
      return 25
    case "annual_report_pdf":
      return 20
    case "website":
      return 12
    case "cause_iq":
      return 10
    case "form_990":
      return 8
    default:
      return 0
  }
}

export function impactSourceTierLabel(tier: ImpactSourceTier): string {
  switch (tier) {
    case "evaluator":
      return "ACE / evaluator"
    case "annual_report_pdf":
      return "Annual report PDF"
    case "website":
      return "Website impact"
    case "cause_iq":
      return "Cause IQ profile"
    case "form_990":
      return "Form 990 only"
    default:
      return "No impact data"
  }
}

function hasVagueImpactOnly(combinedImpactText: string, outcomeCount: number, keywordMatches: number): boolean {
  return (
    combinedImpactText.length > 0 &&
    outcomeCount === 0 &&
    keywordMatches === 0 &&
    (combinedImpactText.includes("mission") ||
      combinedImpactText.includes("help") ||
      combinedImpactText.includes("support"))
  )
}

function countImpactKeywordMatches(text: string): number {
  const keywords = [
    "rescued",
    "rescue",
    "adopted",
    "adoption",
    "sanctuary",
    "wildlife",
    "investigation",
    "animals helped",
    "outcome",
    "measurable",
    "lives saved",
  ]
  return keywords.filter((keyword) => text.includes(keyword)).length
}

export function getImpactEvidenceLevel(organization: Organization): ImpactEvidenceLevel {
  const impactNotes = toSafeString(organization.impactEvidenceNotes).trim()
  const notes = `${impactNotes} ${toSafeString(organization.notes)}`.toLowerCase()
  const combinedImpactText = `${impactNotes} ${notes}`.toLowerCase()
  const tier = detectImpactSourceTier(organization)
  const outcomeCount = Math.max(
    organization.quantifiedOutcomeCount ?? 0,
    countQuantifiedOutcomesFromText(combinedImpactText),
  )
  const keywordMatches = countImpactKeywordMatches(combinedImpactText)
  const hasAnnualReportReference =
    notes.includes("annual report") || notes.includes("impact report") || impactNotes.toLowerCase().includes("annual report pdf")

  if (!impactNotes && tier === "none" && !hasAnnualReportReference) {
    return "Not comparable / insufficient evidence"
  }

  if (tier === "evaluator") {
    return "Strong documented impact"
  }

  if (tier === "annual_report_pdf") {
    return outcomeCount >= 3 ? "Strong documented impact" : "Basic documented impact"
  }

  if (tier === "website" || tier === "cause_iq") {
    return outcomeCount >= 1 ? "Basic documented impact" : "Limited impact evidence"
  }

  if (tier === "form_990") {
    const hasStrong990Evidence =
      outcomeCount >= 3 || combinedImpactText.includes("key quantified outcomes")
    if (hasStrong990Evidence) {
      return "Basic documented impact"
    }
    if (hasVagueImpactOnly(combinedImpactText, outcomeCount, keywordMatches)) {
      return "Limited impact evidence"
    }
    if (outcomeCount >= 1 || keywordMatches >= 1) {
      return "Basic documented impact"
    }
    return "Limited impact evidence"
  }

  if (impactNotes && outcomeCount >= 3) {
    return "Basic documented impact"
  }

  if (impactNotes) {
    return "Limited impact evidence"
  }

  return "Not comparable / insufficient evidence"
}

export function impactEvidenceLevelRank(level: ImpactEvidenceLevel): number {
  switch (level) {
    case "Strong documented impact":
      return 4
    case "Basic documented impact":
      return 3
    case "Limited impact evidence":
      return 2
    default:
      return 1
  }
}

export function impactEvidenceLevelMeetsBasic(level: ImpactEvidenceLevel): boolean {
  return level === "Strong documented impact" || level === "Basic documented impact"
}

export function impactEvidenceLevelMeetsStrong(level: ImpactEvidenceLevel): boolean {
  return level === "Strong documented impact"
}

export function syncImpactMetadata(organization: Organization): Organization {
  const combinedText = `${toSafeString(organization.impactEvidenceNotes)} ${toSafeString(organization.notes)}`
  const tier = detectImpactSourceTier(organization)
  const outcomeCount = Math.max(organization.quantifiedOutcomeCount ?? 0, countQuantifiedOutcomesFromText(combinedText))
  const dataYear = organization.impactDataYear ?? detectImpactDataYear(combinedText)

  return {
    ...organization,
    impactSourceTier: tier,
    quantifiedOutcomeCount: outcomeCount,
    impactDataYear: dataYear,
  }
}
