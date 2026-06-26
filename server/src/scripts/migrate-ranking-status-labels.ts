import { copyFile, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { Organization } from "../types/organization.js"
import { syncDonationDerivedFields } from "../services/donation-service.js"
import { normalizeOrganization } from "../services/data-store-service.js"
import { rankOrganizations } from "../services/ranking-service.js"
import {
  applyCanonicalRankingLabels,
  LEGACY_RANKING_STATUS_VALUES,
  LEGACY_RECOMMENDATION_VALUES,
  organizationHasLegacyRankingLabels,
} from "../services/ranking-label-fields.js"

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const ORGANIZATIONS_PATH = resolve(currentDirectory, "..", "..", "data", "organizations.json")

function formatBackupTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-")
}

async function readRawOrganizations(): Promise<Organization[]> {
  const content = await readFile(ORGANIZATIONS_PATH, "utf-8")
  return JSON.parse(content) as Organization[]
}

async function migrateRankingStatusLabels(): Promise<{
  backupPath: string
  migratedCount: number
  recommendationLabelChanges: number
}> {
  const rawOrganizations = await readRawOrganizations()
  const beforeRecommendations = rawOrganizations.map(
    (organization) => organization.scoreBreakdown?.recommendation ?? organization.recommendation,
  ) as string[]

  const backupPath = `${ORGANIZATIONS_PATH}.backup-ranking-labels-${formatBackupTimestamp(new Date())}.json`
  await copyFile(ORGANIZATIONS_PATH, backupPath)

  const labelMigrated = rawOrganizations.map((organization) => applyCanonicalRankingLabels(organization))

  const normalizedOrganizations = labelMigrated.map(normalizeOrganization)
  const rankedOrganizations = rankOrganizations(normalizedOrganizations.map(syncDonationDerivedFields))

  await writeFile(ORGANIZATIONS_PATH, `${JSON.stringify(rankedOrganizations, null, 2)}\n`, "utf-8")

  const recommendationLabelChanges = rankedOrganizations.filter((organization, index) => {
    const before = beforeRecommendations[index]
    const after = organization.recommendation
    if (before === "Keep Small Until Verified" && after === "Keep Small Until Research Complete") return false
    return before !== after
  }).length

  return {
    backupPath,
    migratedCount: rankedOrganizations.length,
    recommendationLabelChanges,
  }
}

async function validateMigration(expectedCount?: number): Promise<{
  ok: boolean
  organizationCount: number
  organizationsWithLegacyLabels: number
  recommendationCounts: Record<string, number>
}> {
  const organizations = await readRawOrganizations()
  const organizationsWithLegacyLabels = organizations.filter((organization) =>
    organizationHasLegacyRankingLabels(organization as unknown as Record<string, unknown>),
  ).length

  const recommendationCounts: Record<string, number> = {}
  for (const organization of organizations) {
    const recommendation = organization.recommendation
    recommendationCounts[recommendation] = (recommendationCounts[recommendation] ?? 0) + 1
  }

  const ok =
    organizationsWithLegacyLabels === 0 &&
    (expectedCount === undefined || organizations.length === expectedCount)

  return {
    ok,
    organizationCount: organizations.length,
    organizationsWithLegacyLabels,
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
          legacyRankingStatusValuesChecked: LEGACY_RANKING_STATUS_VALUES,
          legacyRecommendationValuesChecked: LEGACY_RECOMMENDATION_VALUES,
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
  const migrationResult = await migrateRankingStatusLabels()
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
