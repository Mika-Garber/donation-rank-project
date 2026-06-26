import type { Organization, StewardshipScoreFields } from "../types/organization.js"

export const LEGACY_STEWARDSHIP_FIELD_KEYS = [
  "preliminaryScore",
  "verifiedDonationWorthinessScore",
  "objectiveDonationWorthinessScore",
  "personalizedDonationWorthinessScore",
  "donationWorthinessScore",
  "worthinessScoreLabel",
] as const

type StewardshipSource = Partial<StewardshipScoreFields>

export function resolveStewardshipScoreFields(source: StewardshipSource): StewardshipScoreFields {
  const objectiveStewardshipScore = source.objectiveStewardshipScore ?? source.stewardshipScore ?? 0
  const stewardshipScore = source.stewardshipScore ?? objectiveStewardshipScore
  const verifiedStewardshipScore = source.verifiedStewardshipScore ?? null
  const personalizedStewardshipScore = source.personalizedStewardshipScore ?? stewardshipScore
  const preliminaryStewardshipScore = source.preliminaryStewardshipScore ?? objectiveStewardshipScore
  const stewardshipScoreLabel = source.stewardshipScoreLabel ?? "Preliminary 0*"

  return {
    preliminaryStewardshipScore,
    verifiedStewardshipScore,
    objectiveStewardshipScore,
    personalizedStewardshipScore,
    stewardshipScore,
    stewardshipScoreLabel,
  }
}

export function resolveVerifiedStewardshipScore(source: StewardshipSource): number {
  const fields = resolveStewardshipScoreFields(source)
  return fields.verifiedStewardshipScore ?? fields.preliminaryStewardshipScore ?? fields.stewardshipScore ?? 0
}

export function resolveObjectiveStewardshipScore(source: StewardshipSource): number {
  return resolveStewardshipScoreFields(source).objectiveStewardshipScore
}

export function resolvePreliminaryStewardshipScore(source: StewardshipSource): number {
  return resolveStewardshipScoreFields(source).preliminaryStewardshipScore
}

function stripLegacyStewardshipFieldsFromObject<T extends object>(record: T): T {
  const stripped = { ...record } as Record<string, unknown>
  for (const key of LEGACY_STEWARDSHIP_FIELD_KEYS) {
    delete stripped[key]
  }
  return stripped as T
}

export function stripLegacyStewardshipFields(organization: Organization): Organization {
  const scoreBreakdown = organization.scoreBreakdown
    ? stripLegacyStewardshipFieldsFromObject(organization.scoreBreakdown)
    : organization.scoreBreakdown

  return {
    ...stripLegacyStewardshipFieldsFromObject(organization),
    scoreBreakdown,
  }
}

export function organizationHasLegacyStewardshipFields(organization: Record<string, unknown>): boolean {
  for (const key of LEGACY_STEWARDSHIP_FIELD_KEYS) {
    if (key in organization) return true
  }
  const scoreBreakdown = organization.scoreBreakdown
  if (scoreBreakdown && typeof scoreBreakdown === "object") {
    for (const key of LEGACY_STEWARDSHIP_FIELD_KEYS) {
      if (key in scoreBreakdown) return true
    }
  }
  return false
}
