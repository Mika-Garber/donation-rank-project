import type { AdvocacyReviewStatus, MissionBucket, Organization } from "../types/organization.js"
import { getMissionBucket } from "./ranking-list-service.js"

const NONE_DOCUMENTED_PHRASES = [
  "no major partisan campaign activity identified",
  "no partisan campaign activity identified",
  "no campaign activity identified",
  "no significant lobbying identified",
  "no lobbying identified",
  "no ballot activity identified",
  "direct-service oriented",
  "activity appears direct-service oriented",
  "no major political activity identified",
  "no major partisan campaign activity",
  "no partisan campaign activity",
  "no significant partisan campaign",
  "no partisan campaign",
  "not engaged in campaign",
  "no campaign activity",
  "no significant lobbying",
  "no lobbying activity identified",
]

const PARTISAN_RED_FLAG_PHRASES = [
  "candidate endorsement",
  "endorsed candidate",
  "endorses candidate",
  "partisan campaign",
  "campaign contribution",
  "campaign contributions",
  "political action committee",
  "supports candidates",
  "opposes candidates",
  "support candidates",
  "oppose candidates",
]

const PARTISAN_PAUSE_PHRASES = [
  "candidate endorsement",
  "endorsed candidate",
  "endorses candidate",
  "campaign contribution",
  "campaign contributions",
  "supports candidates",
  "opposes candidates",
  "support candidates",
  "oppose candidates",
]

const DONOR_COMFORT_PHRASES = [
  "lobbying",
  "lobby ",
  "lobbying activity",
  "ballot initiative",
  "ballot initiatives",
  "campaign-style advocacy",
  "policy campaign",
  "legislative advocacy",
  "advocacy campaign",
  "public policy work",
  "legal advocacy",
  "legal campaigning",
  "ballot measure",
  "ballot activity",
]

const NONPARTISAN_PHRASES = [
  "nonpartisan",
  "non-partisan",
  "low political",
  "minimal advocacy",
  "issue-focused",
  "mission-linked",
  "mission-aligned",
  "mission aligned",
  "direct-service",
  "direct service",
  "policy involvement appears mission-linked",
]

function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return String(value)
}

function normalizeHaystack(organization: Organization): string {
  const politicalNotes = toSafeString(organization.politicalInvolvementNotes).trim()
  return `${politicalNotes} ${toSafeString(organization.notes)}`.toLowerCase().replace(/\s+/g, " ")
}

function isLegalAdvocacyOrganization(organization: Organization, missionBucket: MissionBucket): boolean {
  const category = organization.category.toLowerCase()
  const subcategory = organization.subcategory.toLowerCase()
  const haystack = normalizeHaystack(organization)
  return (
    category.includes("legal") ||
    subcategory.includes("legal") ||
    missionBucket === "Animal Legal Advocacy" ||
    haystack.includes("legal advocacy") ||
    haystack.includes("legal campaigning") ||
    haystack.includes("advocacy and legal") ||
    haystack.includes("policy and legal")
  )
}

function includesPacReference(haystack: string): boolean {
  return /\bpac\b/.test(haystack) || haystack.includes("political action committee")
}

function phraseIsNegated(haystack: string, phrase: string): boolean {
  const index = haystack.indexOf(phrase)
  if (index === -1) return false
  const windowStart = Math.max(0, index - 48)
  const prefix = haystack.slice(windowStart, index)
  return (
    prefix.includes("no ") ||
    prefix.includes("not ") ||
    prefix.includes("without ") ||
    prefix.includes("never ") ||
    prefix.includes("none ") ||
    prefix.includes("rather than ") ||
    prefix.includes("instead of ")
  )
}

function includesAnyPhrase(haystack: string, phrases: string[]): string | null {
  for (const phrase of phrases) {
    if (haystack.includes(phrase)) return phrase
  }
  return null
}

function includesAnyPhraseUnlessNegated(haystack: string, phrases: string[]): string | null {
  for (const phrase of phrases) {
    if (!haystack.includes(phrase)) continue
    if (phraseIsNegated(haystack, phrase)) continue
    return phrase
  }
  return null
}

function hasNonpartisanSignal(haystack: string): boolean {
  return NONPARTISAN_PHRASES.some((phrase) => haystack.includes(phrase))
}

export function deriveAdvocacyReviewStatus(
  organization: Organization,
  missionBucket: MissionBucket = getMissionBucket(organization.category, organization.subcategory),
): AdvocacyReviewStatus {
  const politicalNotes = toSafeString(organization.politicalInvolvementNotes).trim()
  const haystack = normalizeHaystack(organization)
  const isLegalAdvocacy = isLegalAdvocacyOrganization(organization, missionBucket)

  if (!politicalNotes) {
    if (organization.researchAttempts === 0 || organization.researchStatus === "not_started") {
      return "not_reviewed"
    }
    return "notes_missing"
  }

  if (includesAnyPhrase(haystack, NONE_DOCUMENTED_PHRASES)) {
    return "none_documented"
  }

  const partisanPhrase = includesAnyPhraseUnlessNegated(haystack, PARTISAN_RED_FLAG_PHRASES)
  if (partisanPhrase || (includesPacReference(haystack) && !phraseIsNegated(haystack, "pac"))) {
    return "partisan_red_flag"
  }

  const donorComfortPhrase = includesAnyPhraseUnlessNegated(haystack, DONOR_COMFORT_PHRASES)
  if (donorComfortPhrase) {
    if (isLegalAdvocacy && (hasNonpartisanSignal(haystack) || donorComfortPhrase === "legal advocacy" || donorComfortPhrase === "legal campaigning")) {
      return "nonpartisan_documented"
    }
    if (hasNonpartisanSignal(haystack) && !haystack.includes("high political") && !haystack.includes("major political")) {
      return "nonpartisan_documented"
    }
    return "donor_comfort_review"
  }

  if (haystack.includes("unclear") || haystack.includes("unknown political")) {
    return "donor_comfort_review"
  }

  if (haystack.includes("high political") || haystack.includes("major political")) {
    return "donor_comfort_review"
  }

  if (hasNonpartisanSignal(haystack)) {
    return "nonpartisan_documented"
  }

  if (isLegalAdvocacy) {
    return "nonpartisan_documented"
  }

  if (haystack.includes("advocacy") || haystack.includes("policy") || haystack.includes("lobby")) {
    return "nonpartisan_documented"
  }

  return "none_documented"
}

export function advocacyStatusCapsRecommendation(status: AdvocacyReviewStatus): boolean {
  return status === "donor_comfort_review" || status === "partisan_red_flag"
}

export function advocacyStatusForcesPause(status: AdvocacyReviewStatus, haystack: string): boolean {
  if (status !== "partisan_red_flag") return false
  return (
    includesAnyPhraseUnlessNegated(haystack, PARTISAN_PAUSE_PHRASES) !== null ||
    (includesPacReference(haystack) && !phraseIsNegated(haystack, "pac"))
  )
}

export function advocacyStatusBlocksLegacy(status: AdvocacyReviewStatus): boolean {
  return status === "donor_comfort_review" || status === "partisan_red_flag"
}

export function advocacyStatusNeedsPoliticalNotes(status: AdvocacyReviewStatus): boolean {
  return status === "notes_missing" || status === "not_reviewed"
}

export function resolveAdvocacyReviewStatusInput(
  input: { advocacyReviewStatus?: AdvocacyReviewStatus; politicalReviewFlag?: boolean },
  fallback: AdvocacyReviewStatus = "not_reviewed",
): AdvocacyReviewStatus {
  if (input.advocacyReviewStatus) return input.advocacyReviewStatus
  if (input.politicalReviewFlag === true) return "donor_comfort_review"
  return fallback
}

export function organizationHasLegacyPoliticalReviewFlag(organization: Record<string, unknown>): boolean {
  if ("politicalReviewFlag" in organization) return true
  const scoreBreakdown = organization.scoreBreakdown
  return typeof scoreBreakdown === "object" && scoreBreakdown !== null && "politicalReviewFlag" in scoreBreakdown
}

export function stripLegacyPoliticalReviewFlag<T extends Record<string, unknown>>(organization: T): T {
  const { politicalReviewFlag: _root, ...rest } = organization
  if (rest.scoreBreakdown && typeof rest.scoreBreakdown === "object" && rest.scoreBreakdown !== null) {
    const { politicalReviewFlag: _scoreBreakdown, ...scoreBreakdownRest } = rest.scoreBreakdown as Record<
      string,
      unknown
    >
    return { ...rest, scoreBreakdown: scoreBreakdownRest } as unknown as T
  }
  return rest as unknown as T
}

export function advocacyReviewStatusSummary(status: AdvocacyReviewStatus): string {
  switch (status) {
    case "none_documented":
      return "No significant advocacy or partisan political activity documented."
    case "nonpartisan_documented":
      return "Nonpartisan or mission-aligned advocacy is documented."
    case "notes_missing":
      return "Advocacy notes are missing — finish research before increasing giving."
    case "not_reviewed":
      return "Advocacy involvement has not been reviewed yet."
    case "donor_comfort_review":
      return "Advocacy or policy activity may need donor comfort review."
    case "partisan_red_flag":
      return "Partisan political activity needs donor review."
    default:
      return "Advocacy review status is unknown."
  }
}

export function shouldShowAdvocacyReviewChip(status: AdvocacyReviewStatus): boolean {
  return status !== "none_documented"
}
