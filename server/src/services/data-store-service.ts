import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { constants } from "node:fs"
import { randomUUID } from "node:crypto"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { DonationRecord, Organization, OrganizationAddress, ScoreBreakdown } from "../types/organization.js"
import { createOrganizationFromInput, loadSeedOrganizationsFromCsv } from "./csv-seed-service.js"
import { getCurrentYearDonationTotal, syncDonationDerivedFields } from "./donation-service.js"
import { rankOrganizations } from "./ranking-service.js"
import { resolveStewardshipScoreFields } from "./stewardship-score-fields.js"
import { normalizeRankingStatus, normalizeRecommendation } from "./ranking-label-fields.js"
import {
  resolveAdvocacyReviewStatusInput,
  stripLegacyPoliticalReviewFlag,
} from "./advocacy-review-service.js"

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const BUNDLED_DATA_DIRECTORY = resolve(currentDirectory, "..", "..", "data")
const BUNDLED_ORGANIZATIONS_PATH = resolve(BUNDLED_DATA_DIRECTORY, "organizations.json")
const ACTIVE_DATA_DIRECTORY = process.env.VERCEL
  ? resolve("/tmp", "donation-rank-data")
  : BUNDLED_DATA_DIRECTORY
const ORGANIZATIONS_PATH = resolve(ACTIVE_DATA_DIRECTORY, "organizations.json")
const REFRESH_LOG_PATH = resolve(ACTIVE_DATA_DIRECTORY, "refresh-log.json")

let cachedOrganizations: Organization[] | null = null

const EMPTY_ADDRESS: OrganizationAddress = {
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
}

function parseLocationFromNotes(notes: string): Pick<OrganizationAddress, "city" | "state"> {
  const match = notes.match(/Public source location match:\s*([^,|]+),\s*([A-Z]{2})/i)
  if (!match) return { city: "", state: "" }
  return {
    city: match[1]?.trim() ?? "",
    state: match[2]?.trim().toUpperCase() ?? "",
  }
}

function migrateLegacyDonation(organization: Organization): DonationRecord[] {
  const existingDonations = organization.donations ?? []
  if (existingDonations.length > 0) return existingDonations
  if ((organization.approximateAnnualDonation ?? 0) <= 0) return []

  return [
    {
      id: randomUUID(),
      date: `${new Date().getFullYear()}-01-01`,
      amount: organization.approximateAnnualDonation,
      note: "Imported from annual estimate — replace with actual gifts as you log them.",
    },
  ]
}

function normalizeAddress(organization: Organization): OrganizationAddress {
  const address = organization.address ?? EMPTY_ADDRESS
  const parsedLocation = parseLocationFromNotes(organization.notes ?? "")

  return {
    street: address.street ?? "",
    city: address.city || parsedLocation.city || "",
    state: address.state || parsedLocation.state || "",
    postalCode: address.postalCode ?? "",
    country: address.country?.trim() || "US",
  }
}

export function normalizeOrganization(organization: Organization): Organization {
  const rawOrganization = organization as Organization & { politicalReviewFlag?: boolean }
  const advocacyReviewStatus = resolveAdvocacyReviewStatusInput(rawOrganization, "not_reviewed")
  const strippedOrganization = stripLegacyPoliticalReviewFlag(
    organization as unknown as Record<string, unknown>,
  ) as unknown as Organization
  const donations = migrateLegacyDonation(strippedOrganization)
  const stewardshipFields = resolveStewardshipScoreFields(strippedOrganization)
  const normalized: Organization = {
    ...strippedOrganization,
    ...stewardshipFields,
    sourceMeta: strippedOrganization.sourceMeta ?? {},
    researchStatus: strippedOrganization.researchStatus ?? "not_started",
    researchAttempts: strippedOrganization.researchAttempts ?? 0,
    researchErrors: strippedOrganization.researchErrors ?? [],
    donations,
    address: normalizeAddress(strippedOrganization),
    rankingStatus: normalizeRankingStatus(strippedOrganization.rankingStatus ?? "Not Researched"),
    donorConfidenceAdjustment: strippedOrganization.donorConfidenceAdjustment ?? 0,
    donorConfidenceReason: strippedOrganization.donorConfidenceReason ?? "No donor history signal applied.",
    objectiveRank: strippedOrganization.objectiveRank ?? 0,
    personalizedRank: strippedOrganization.personalizedRank ?? 0,
    globalObjectiveRank: strippedOrganization.globalObjectiveRank ?? strippedOrganization.objectiveRank ?? 0,
    globalPersonalizedRank: strippedOrganization.globalPersonalizedRank ?? strippedOrganization.personalizedRank ?? 0,
    listObjectiveRank: strippedOrganization.listObjectiveRank ?? strippedOrganization.objectiveRank ?? 0,
    listPersonalizedRank: strippedOrganization.listPersonalizedRank ?? strippedOrganization.personalizedRank ?? 0,
    rankingListSize: strippedOrganization.rankingListSize ?? 0,
    rankShift: strippedOrganization.rankShift ?? 0,
    rankShiftReason: strippedOrganization.rankShiftReason ?? "No personalized adjustment was applied.",
    legalVerificationStatus: strippedOrganization.legalVerificationStatus ?? "Insufficient Data",
    missionFitScore: strippedOrganization.missionFitScore ?? 70,
    impactEvidenceLevel: strippedOrganization.impactEvidenceLevel ?? "Not comparable / insufficient evidence",
    financialCompletenessStatus: strippedOrganization.financialCompletenessStatus ?? "missing",
    watchdogReviewRequired: strippedOrganization.watchdogReviewRequired ?? false,
    advocacyReviewStatus,
    rankingModelVersion: strippedOrganization.rankingModelVersion ?? "stewardship-v1",
    impactEvidenceScore: strippedOrganization.impactEvidenceScore ?? 0,
    accountabilityScore: strippedOrganization.accountabilityScore ?? 0,
    financialEfficiencyScore: strippedOrganization.financialEfficiencyScore ?? null,
    financialEfficiencyStatus: strippedOrganization.financialEfficiencyStatus ?? "unknown",
    governanceScore: strippedOrganization.governanceScore ?? 0,
    politicalRiskScore: strippedOrganization.politicalRiskScore ?? 0,
    confidenceScore: strippedOrganization.confidenceScore ?? 0,
    confidenceBand: strippedOrganization.confidenceBand ?? "Low",
    scoreBand: strippedOrganization.scoreBand ?? "Insufficient Data",
    organizationSize: strippedOrganization.organizationSize ?? "unknown",
    identityVerified: strippedOrganization.identityVerified ?? false,
    financialsVerified: strippedOrganization.financialsVerified ?? false,
    impactDocumented: strippedOrganization.impactDocumented ?? false,
    politicalReviewed: strippedOrganization.politicalReviewed ?? false,
    recommendation: normalizeRecommendation(strippedOrganization.recommendation ?? "Review Before Donating"),
    donationAmountAssessment:
      strippedOrganization.donationAmountAssessment ?? "No assessment yet. Run research to generate guidance.",
    suggestedDonationAction: strippedOrganization.suggestedDonationAction ?? "Needs quick review before donating.",
    suggestedDonationLevel: strippedOrganization.suggestedDonationLevel ?? "Research First",
    legacyEligible: strippedOrganization.legacyEligible ?? false,
    legacyTier: strippedOrganization.legacyTier ?? "Not Legacy Eligible",
    legacyRationale: strippedOrganization.legacyRationale ?? "Legacy criteria are not yet met.",
    legacyExclusionReason: strippedOrganization.legacyExclusionReason ?? null,
    missionBucket: strippedOrganization.missionBucket ?? "Other",
    rankingListKey: strippedOrganization.rankingListKey ?? "",
    rankingListLabel: strippedOrganization.rankingListLabel ?? strippedOrganization.missionBucket ?? "Other",
    compactGivingRole: strippedOrganization.compactGivingRole ?? "Watchlist",
    politicalInvolvementNotes: strippedOrganization.politicalInvolvementNotes ?? "",
    impactEvidenceNotes: strippedOrganization.impactEvidenceNotes ?? "",
    accountabilityNotes: strippedOrganization.accountabilityNotes ?? "",
    impactSourceTier: strippedOrganization.impactSourceTier ?? "none",
    quantifiedOutcomeCount: strippedOrganization.quantifiedOutcomeCount ?? 0,
    impactDataYear: strippedOrganization.impactDataYear ?? null,
    redFlags: strippedOrganization.redFlags ?? [],
    nextAction: strippedOrganization.nextAction ?? "Needs quick review.",
    criticalMissingFields: strippedOrganization.criticalMissingFields ?? [],
    strongestNextResearchStep: strippedOrganization.strongestNextResearchStep ?? "Find EIN",
    duplicateMission: strippedOrganization.duplicateMission ?? "",
    duplicateMissionGroup: strippedOrganization.duplicateMissionGroup ?? "",
    duplicateMissionRole: strippedOrganization.duplicateMissionRole ?? "",
    manualOverlapGroupKey: strippedOrganization.manualOverlapGroupKey ?? "",
    manualOverlapGroupLabel: strippedOrganization.manualOverlapGroupLabel ?? "",
    checkPayeeName: strippedOrganization.checkPayeeName ?? "",
    donationMailingAddressLine1: strippedOrganization.donationMailingAddressLine1 ?? "",
    donationMailingAddressLine2: strippedOrganization.donationMailingAddressLine2 ?? "",
    donationMailingCity: strippedOrganization.donationMailingCity ?? "",
    donationMailingState: strippedOrganization.donationMailingState ?? "",
    donationMailingZip: strippedOrganization.donationMailingZip ?? "",
    donationMailingCountry: strippedOrganization.donationMailingCountry ?? "",
    advisorExportNotes: strippedOrganization.advisorExportNotes ?? "",
    charityNavigatorRating: strippedOrganization.charityNavigatorRating ?? null,
    charityNavigatorProfileUrl: strippedOrganization.charityNavigatorProfileUrl ?? "",
    charityNavigatorAlert: strippedOrganization.charityNavigatorAlert ?? "",
    charityWatchGrade: strippedOrganization.charityWatchGrade ?? null,
    aceRecommendation: strippedOrganization.aceRecommendation ?? null,
    approximateAnnualDonation:
      donations.length > 0 ? getCurrentYearDonationTotal(donations) : strippedOrganization.approximateAnnualDonation ?? 0,
  }

  return {
    ...normalized,
    scoreBreakdown: normalized.scoreBreakdown
      ? ({
          ...stripLegacyPoliticalReviewFlag(normalized.scoreBreakdown as unknown as Record<string, unknown>),
          rankingStatus: normalizeRankingStatus(normalized.scoreBreakdown.rankingStatus),
          recommendation: normalizeRecommendation(normalized.scoreBreakdown.recommendation),
          advocacyReviewStatus: resolveAdvocacyReviewStatusInput(
            normalized.scoreBreakdown as ScoreBreakdown & { politicalReviewFlag?: boolean },
            advocacyReviewStatus,
          ),
        } as ScoreBreakdown)
      : normalized.scoreBreakdown,
  }
}

async function ensureSeededFile(): Promise<void> {
  await mkdir(ACTIVE_DATA_DIRECTORY, { recursive: true })
  try {
    await access(ORGANIZATIONS_PATH, constants.F_OK)
  } catch {
    try {
      const bundledContent = await readFile(BUNDLED_ORGANIZATIONS_PATH, "utf-8")
      await writeFile(ORGANIZATIONS_PATH, bundledContent, "utf-8")
    } catch {
      const seedOrganizations = await loadSeedOrganizationsFromCsv()
      await writeFile(ORGANIZATIONS_PATH, JSON.stringify(seedOrganizations, null, 2), "utf-8")
    }
  }
}

export async function readStoredOrganizations(): Promise<Organization[]> {
  await ensureSeededFile()
  const content = await readFile(ORGANIZATIONS_PATH, "utf-8")
  return (JSON.parse(content) as Organization[]).map(normalizeOrganization)
}

async function writeOrganizations(organizations: Organization[]): Promise<void> {
  await writeFile(ORGANIZATIONS_PATH, JSON.stringify(organizations, null, 2), "utf-8")
}

export async function saveOrganizations(organizations: Organization[]): Promise<void> {
  cachedOrganizations = organizations
  await writeOrganizations(organizations)
}

export async function getOrganizations(): Promise<Organization[]> {
  if (!cachedOrganizations) {
    const organizations = await readStoredOrganizations()
    cachedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  }
  return cachedOrganizations
}

export async function getOrganizationById(id: string): Promise<Organization | undefined> {
  const organizations = await getOrganizations()
  return organizations.find((organization) => organization.id === id)
}

export async function addOrganization(input: Partial<Organization>): Promise<Organization> {
  const newOrganization = createOrganizationFromInput(input)
  const organizations = await readStoredOrganizations()
  organizations.push(newOrganization)
  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  const savedOrganization = rankedOrganizations.find((organization) => organization.id === newOrganization.id)
  if (!savedOrganization) {
    throw new Error("Failed to save organization.")
  }
  cachedOrganizations = rankedOrganizations
  await writeOrganizations(rankedOrganizations)
  return savedOrganization
}

export async function updateOrganizations(organizations: Organization[]): Promise<void> {
  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  cachedOrganizations = rankedOrganizations
  await writeOrganizations(rankedOrganizations)
}

export async function writeRefreshLog(entry: Record<string, unknown>): Promise<void> {
  await writeFile(REFRESH_LOG_PATH, JSON.stringify(entry, null, 2), "utf-8")
}

export async function getRefreshLog(): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(REFRESH_LOG_PATH, "utf-8")
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return null
  }
}
