import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { constants } from "node:fs"
import { randomUUID } from "node:crypto"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { DonationRecord, Organization, OrganizationAddress } from "../types/organization.js"
import { createOrganizationFromInput, loadSeedOrganizationsFromCsv } from "./csv-seed-service.js"
import { getCurrentYearDonationTotal, syncDonationDerivedFields } from "./donation-service.js"
import { rankOrganizations } from "./ranking-service.js"

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const DATA_DIRECTORY = resolve(currentDirectory, "..", "..", "data")
const ORGANIZATIONS_PATH = resolve(DATA_DIRECTORY, "organizations.json")
const REFRESH_LOG_PATH = resolve(DATA_DIRECTORY, "refresh-log.json")

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

function normalizeOrganization(organization: Organization): Organization {
  const donations = migrateLegacyDonation(organization)
  const normalized: Organization = {
    ...organization,
    sourceMeta: organization.sourceMeta ?? {},
    researchStatus: organization.researchStatus ?? "not_started",
    researchAttempts: organization.researchAttempts ?? 0,
    researchErrors: organization.researchErrors ?? [],
    donations,
    address: normalizeAddress(organization),
    rankingStatus: organization.rankingStatus ?? "Not Researched",
    preliminaryScore: organization.preliminaryScore ?? 0,
    verifiedDonationWorthinessScore: organization.verifiedDonationWorthinessScore ?? null,
    objectiveDonationWorthinessScore: organization.objectiveDonationWorthinessScore ?? organization.donationWorthinessScore ?? 0,
    personalizedDonationWorthinessScore:
      organization.personalizedDonationWorthinessScore ?? organization.donationWorthinessScore ?? 0,
    donorConfidenceAdjustment: organization.donorConfidenceAdjustment ?? 0,
    donorConfidenceReason: organization.donorConfidenceReason ?? "No donor history signal applied.",
    objectiveRank: organization.objectiveRank ?? 0,
    personalizedRank: organization.personalizedRank ?? 0,
    globalObjectiveRank: organization.globalObjectiveRank ?? organization.objectiveRank ?? 0,
    globalPersonalizedRank: organization.globalPersonalizedRank ?? organization.personalizedRank ?? 0,
    listObjectiveRank: organization.listObjectiveRank ?? organization.objectiveRank ?? 0,
    listPersonalizedRank: organization.listPersonalizedRank ?? organization.personalizedRank ?? 0,
    rankingListSize: organization.rankingListSize ?? 0,
    rankShift: organization.rankShift ?? 0,
    rankShiftReason: organization.rankShiftReason ?? "No personalized adjustment was applied.",
    donationWorthinessScore: organization.donationWorthinessScore ?? 0,
    impactEvidenceScore: organization.impactEvidenceScore ?? 0,
    accountabilityScore: organization.accountabilityScore ?? 0,
    financialEfficiencyScore: organization.financialEfficiencyScore ?? null,
    financialEfficiencyStatus: organization.financialEfficiencyStatus ?? "unknown",
    governanceScore: organization.governanceScore ?? 0,
    politicalRiskScore: organization.politicalRiskScore ?? 0,
    confidenceScore: organization.confidenceScore ?? 0,
    recommendation: organization.recommendation ?? "Review Before Donating",
    donationAmountAssessment:
      organization.donationAmountAssessment ?? "No assessment yet. Run research to generate guidance.",
    suggestedDonationAction: organization.suggestedDonationAction ?? "Needs quick review before donating.",
    suggestedDonationLevel: organization.suggestedDonationLevel ?? "Research First",
    legacyEligible: organization.legacyEligible ?? false,
    legacyTier: organization.legacyTier ?? "Not Legacy Eligible",
    legacyRationale: organization.legacyRationale ?? "Legacy criteria are not yet met.",
    missionBucket: organization.missionBucket ?? "Other",
    rankingListKey: organization.rankingListKey ?? "",
    rankingListLabel: organization.rankingListLabel ?? organization.missionBucket ?? "Other",
    compactGivingRole: organization.compactGivingRole ?? "Watchlist",
    politicalInvolvementNotes: organization.politicalInvolvementNotes ?? "",
    impactEvidenceNotes: organization.impactEvidenceNotes ?? "",
    accountabilityNotes: organization.accountabilityNotes ?? "",
    redFlags: organization.redFlags ?? [],
    nextAction: organization.nextAction ?? "Needs quick review.",
    criticalMissingFields: organization.criticalMissingFields ?? [],
    strongestNextResearchStep: organization.strongestNextResearchStep ?? "Find EIN",
    charityNavigatorRating: organization.charityNavigatorRating ?? null,
    charityNavigatorProfileUrl: organization.charityNavigatorProfileUrl ?? "",
    charityNavigatorAlert: organization.charityNavigatorAlert ?? "",
    charityWatchGrade: organization.charityWatchGrade ?? null,
    aceRecommendation: organization.aceRecommendation ?? null,
    approximateAnnualDonation:
      donations.length > 0 ? getCurrentYearDonationTotal(donations) : organization.approximateAnnualDonation ?? 0,
  }

  return normalized
}

async function ensureSeededFile(): Promise<void> {
  await mkdir(DATA_DIRECTORY, { recursive: true })
  try {
    await access(ORGANIZATIONS_PATH, constants.F_OK)
  } catch {
    const seedOrganizations = await loadSeedOrganizationsFromCsv()
    await writeFile(ORGANIZATIONS_PATH, JSON.stringify(seedOrganizations, null, 2), "utf-8")
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
  cachedOrganizations = organizations
  await writeOrganizations(organizations)
  return newOrganization
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
