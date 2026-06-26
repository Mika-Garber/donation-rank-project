import { copyFile, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { AdvocacyReviewStatus, Organization, Recommendation } from "../types/organization.js"
import {
  organizationHasLegacyPoliticalReviewFlag,
  resolveAdvocacyReviewStatusInput,
  stripLegacyPoliticalReviewFlag,
} from "../services/advocacy-review-service.js"
import { syncDonationDerivedFields } from "../services/donation-service.js"
import { normalizeOrganization } from "../services/data-store-service.js"
import { rankOrganizations } from "../services/ranking-service.js"

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const ORGANIZATIONS_PATH = resolve(currentDirectory, "..", "..", "data", "organizations.json")

function formatBackupTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-")
}

async function readRawOrganizations(): Promise<Organization[]> {
  const content = await readFile(ORGANIZATIONS_PATH, "utf-8")
  return JSON.parse(content) as Organization[]
}

function getRecommendation(organization: Organization): Recommendation {
  return organization.scoreBreakdown?.recommendation ?? organization.recommendation
}

async function migrateRemovePoliticalReviewFlag(): Promise<{
  backupPath: string
  migratedCount: number
  recommendationChanges: number
  organizationsWithLegacyFieldBefore: number
}> {
  const rawOrganizations = await readRawOrganizations()
  const beforeRecommendations = rawOrganizations.map(getRecommendation)
  const organizationsWithLegacyFieldBefore = rawOrganizations.filter((organization) =>
    organizationHasLegacyPoliticalReviewFlag(organization as unknown as Record<string, unknown>),
  ).length

  const backupPath = `${ORGANIZATIONS_PATH}.backup-political-review-flag-${formatBackupTimestamp(new Date())}.json`
  await copyFile(ORGANIZATIONS_PATH, backupPath)

  const preparedOrganizations = rawOrganizations.map((organization) => {
    const rawRecord = organization as Organization & { politicalReviewFlag?: boolean }
    const advocacyReviewStatus = resolveAdvocacyReviewStatusInput(rawRecord, "not_reviewed")
    const stripped = stripLegacyPoliticalReviewFlag(
      organization as unknown as Record<string, unknown>,
    ) as unknown as Organization
    return { ...stripped, advocacyReviewStatus }
  })

  const normalizedOrganizations = preparedOrganizations.map(normalizeOrganization)
  const rankedOrganizations = rankOrganizations(normalizedOrganizations.map(syncDonationDerivedFields))

  await writeFile(ORGANIZATIONS_PATH, `${JSON.stringify(rankedOrganizations, null, 2)}\n`, "utf-8")

  const recommendationChanges = rankedOrganizations.filter(
    (organization, index) => getRecommendation(organization) !== beforeRecommendations[index],
  ).length

  return {
    backupPath,
    migratedCount: rankedOrganizations.length,
    recommendationChanges,
    organizationsWithLegacyFieldBefore,
  }
}

async function validateMigration(expectedCount?: number): Promise<{
  ok: boolean
  organizationCount: number
  organizationsWithLegacyField: number
  organizationsMissingAdvocacyReviewStatus: number
  advocacyReviewStatusCounts: Record<AdvocacyReviewStatus, number>
  recommendationCounts: Record<string, number>
}> {
  const organizations = await readRawOrganizations()
  const organizationsWithLegacyField = organizations.filter((organization) =>
    organizationHasLegacyPoliticalReviewFlag(organization as unknown as Record<string, unknown>),
  ).length
  const organizationsMissingAdvocacyReviewStatus = organizations.filter(
    (organization) => !organization.advocacyReviewStatus,
  ).length

  const advocacyReviewStatusCounts = {
    none_documented: 0,
    nonpartisan_documented: 0,
    notes_missing: 0,
    not_reviewed: 0,
    donor_comfort_review: 0,
    partisan_red_flag: 0,
  } satisfies Record<AdvocacyReviewStatus, number>

  const recommendationCounts: Record<string, number> = {}

  for (const organization of organizations) {
    advocacyReviewStatusCounts[organization.advocacyReviewStatus] =
      (advocacyReviewStatusCounts[organization.advocacyReviewStatus] ?? 0) + 1
    recommendationCounts[organization.recommendation] = (recommendationCounts[organization.recommendation] ?? 0) + 1
  }

  const ok =
    organizationsWithLegacyField === 0 &&
    organizationsMissingAdvocacyReviewStatus === 0 &&
    (expectedCount === undefined || organizations.length === expectedCount)

  return {
    ok,
    organizationCount: organizations.length,
    organizationsWithLegacyField,
    organizationsMissingAdvocacyReviewStatus,
    advocacyReviewStatusCounts,
    recommendationCounts,
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "migrate"

  if (mode === "validate") {
    const expectedCount = process.argv[3] ? Number.parseInt(process.argv[3], 10) : undefined
    const result = await validateMigration(expectedCount)
    console.log(
      JSON.stringify(
        {
          mode: "validate",
          legacyFieldChecked: "politicalReviewFlag",
          ...result,
        },
        null,
        2,
      ),
    )
    if (!result.ok) process.exit(1)
    return
  }

  if (mode !== "migrate") {
    console.error(`Unknown mode: ${mode}. Use "migrate" or "validate".`)
    process.exit(1)
  }

  const beforeCount = (await readRawOrganizations()).length
  const migrationResult = await migrateRemovePoliticalReviewFlag()
  const validationResult = await validateMigration(beforeCount)

  console.log(
    JSON.stringify(
      {
        mode: "migrate",
        ...migrationResult,
        validation: validationResult,
      },
      null,
      2,
    ),
  )

  if (!validationResult.ok) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
