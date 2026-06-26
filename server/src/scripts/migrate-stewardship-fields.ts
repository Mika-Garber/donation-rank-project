import { copyFile, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { Organization, Recommendation } from "../types/organization.js"
import { syncDonationDerivedFields } from "../services/donation-service.js"
import { normalizeOrganization } from "../services/data-store-service.js"
import { rankOrganizations } from "../services/ranking-service.js"
import {
  LEGACY_STEWARDSHIP_FIELD_KEYS,
  organizationHasLegacyStewardshipFields,
  stripLegacyStewardshipFields,
} from "../services/stewardship-score-fields.js"

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const ORGANIZATIONS_PATH = resolve(currentDirectory, "..", "..", "data", "organizations.json")

interface PreservedOrganizationSnapshot {
  organizationName: string
  ein: string
  missionBucket: string
  programPercent: number | null
  fundraisingPercent: number | null
  adminPercent: number | null
  impactEvidenceNotes: string
  sourceMetaKeys: string[]
  recommendation: Recommendation
}

function formatBackupTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-")
}

function getRecommendationBeforeMigration(organization: Organization): Recommendation {
  return organization.scoreBreakdown?.recommendation ?? organization.recommendation ?? "Review Before Donating"
}

function buildPreservedSnapshot(organization: Organization): PreservedOrganizationSnapshot {
  return {
    organizationName: organization.organizationName,
    ein: organization.ein ?? "",
    missionBucket: organization.missionBucket ?? organization.scoreBreakdown?.missionBucket ?? "",
    programPercent: organization.programPercent ?? null,
    fundraisingPercent: organization.fundraisingPercent ?? null,
    adminPercent: organization.adminPercent ?? null,
    impactEvidenceNotes: organization.impactEvidenceNotes ?? "",
    sourceMetaKeys: Object.keys(organization.sourceMeta ?? {}).sort(),
    recommendation: getRecommendationBeforeMigration(organization),
  }
}

function hasCanonicalStewardshipFields(organization: Record<string, unknown>): boolean {
  return (
    typeof organization.stewardshipScore === "number" &&
    typeof organization.objectiveStewardshipScore === "number" &&
    typeof organization.stewardshipScoreLabel === "string"
  )
}

async function readRawOrganizations(): Promise<Organization[]> {
  const content = await readFile(ORGANIZATIONS_PATH, "utf-8")
  return JSON.parse(content) as Organization[]
}

async function migrateOrganizations(): Promise<{
  backupPath: string
  migratedCount: number
  recommendationChanges: Array<{ id: string; organizationName: string; before: Recommendation; after: Recommendation }>
}> {
  const rawOrganizations = await readRawOrganizations()
  const beforeSnapshots = new Map(
    rawOrganizations.map((organization) => [organization.id, buildPreservedSnapshot(organization)]),
  )
  const beforeRecommendations = new Map(
    rawOrganizations.map((organization) => [organization.id, getRecommendationBeforeMigration(organization)]),
  )

  const backupPath = `${ORGANIZATIONS_PATH}.backup-${formatBackupTimestamp(new Date())}.json`
  await copyFile(ORGANIZATIONS_PATH, backupPath)

  const normalizedOrganizations = rawOrganizations.map(normalizeOrganization)
  const rankedOrganizations = rankOrganizations(normalizedOrganizations.map(syncDonationDerivedFields))
  const persistedOrganizations = rankedOrganizations.map(stripLegacyStewardshipFields)

  await writeFile(ORGANIZATIONS_PATH, `${JSON.stringify(persistedOrganizations, null, 2)}\n`, "utf-8")

  const recommendationChanges = persistedOrganizations.flatMap((organization) => {
    const before = beforeRecommendations.get(organization.id)
    const after = organization.recommendation
    if (!before || before === after) return []
    return [
      {
        id: organization.id,
        organizationName: organization.organizationName,
        before,
        after,
      },
    ]
  })

  return {
    backupPath,
    migratedCount: persistedOrganizations.length,
    recommendationChanges,
  }
}

async function validateMigration(
  expectedCount?: number,
  preservedSnapshots?: Map<string, PreservedOrganizationSnapshot>,
): Promise<{
  ok: boolean
  organizationCount: number
  organizationsWithLegacyFields: number
  organizationsMissingCanonicalFields: number
  missingRecommendationCount: number
  missingRankingListKeyCount: number
  preservedDataIssues: string[]
}> {
  const organizations = await readRawOrganizations()
  const preservedDataIssues: string[] = []
  let organizationsWithLegacyFields = 0
  let organizationsMissingCanonicalFields = 0
  let missingRecommendationCount = 0
  let missingRankingListKeyCount = 0

  for (const organization of organizations) {
    const record = organization as unknown as Record<string, unknown>
    const rootHasLegacy = organizationHasLegacyStewardshipFields(record)
    const breakdownHasLegacy =
      organization.scoreBreakdown &&
      organizationHasLegacyStewardshipFields(organization.scoreBreakdown as unknown as Record<string, unknown>)
    if (rootHasLegacy || breakdownHasLegacy) {
      organizationsWithLegacyFields += 1
    }

    const rootHasCanonical = hasCanonicalStewardshipFields(record)
    const breakdownHasCanonical =
      !organization.scoreBreakdown ||
      hasCanonicalStewardshipFields(organization.scoreBreakdown as unknown as Record<string, unknown>)
    if (!rootHasCanonical || !breakdownHasCanonical) {
      organizationsMissingCanonicalFields += 1
    }

    if (!organization.recommendation) {
      missingRecommendationCount += 1
    }
    if (!organization.rankingListKey) {
      missingRankingListKeyCount += 1
    }

    if (!organization.organizationName?.trim()) {
      preservedDataIssues.push(`${organization.id}: missing organizationName`)
    }
    if (organization.ein === undefined) {
      preservedDataIssues.push(`${organization.id}: missing ein field`)
    }
    if (organization.missionBucket === undefined && organization.scoreBreakdown?.missionBucket === undefined) {
      preservedDataIssues.push(`${organization.id}: missing missionBucket`)
    }
    if (organization.sourceMeta === undefined) {
      preservedDataIssues.push(`${organization.id}: missing sourceMeta`)
    }
    if (organization.programPercent === undefined) {
      preservedDataIssues.push(`${organization.id}: missing programPercent field`)
    }
    if (organization.impactEvidenceNotes === undefined) {
      preservedDataIssues.push(`${organization.id}: missing impactEvidenceNotes field`)
    }

    const snapshot = preservedSnapshots?.get(organization.id)
    if (snapshot) {
      if (organization.organizationName !== snapshot.organizationName) {
        preservedDataIssues.push(`${organization.id}: organizationName changed`)
      }
      if ((organization.ein ?? "") !== snapshot.ein) {
        preservedDataIssues.push(`${organization.id}: ein changed`)
      }
      const missionBucket = organization.missionBucket ?? organization.scoreBreakdown?.missionBucket ?? ""
      if (missionBucket !== snapshot.missionBucket) {
        preservedDataIssues.push(`${organization.id}: missionBucket changed`)
      }
      if ((organization.programPercent ?? null) !== snapshot.programPercent) {
        preservedDataIssues.push(`${organization.id}: programPercent changed`)
      }
      if ((organization.fundraisingPercent ?? null) !== snapshot.fundraisingPercent) {
        preservedDataIssues.push(`${organization.id}: fundraisingPercent changed`)
      }
      if ((organization.adminPercent ?? null) !== snapshot.adminPercent) {
        preservedDataIssues.push(`${organization.id}: adminPercent changed`)
      }
      if ((organization.impactEvidenceNotes ?? "") !== snapshot.impactEvidenceNotes) {
        preservedDataIssues.push(`${organization.id}: impactEvidenceNotes changed`)
      }
      const sourceMetaKeys = Object.keys(organization.sourceMeta ?? {}).sort()
      if (sourceMetaKeys.join("|") !== snapshot.sourceMetaKeys.join("|")) {
        preservedDataIssues.push(`${organization.id}: sourceMeta keys changed`)
      }
    }
  }

  if (expectedCount !== undefined && organizations.length !== expectedCount) {
    preservedDataIssues.push(`Organization count changed: expected ${expectedCount}, found ${organizations.length}`)
  }

  const ok =
    organizationsWithLegacyFields === 0 &&
    organizationsMissingCanonicalFields === 0 &&
    missingRecommendationCount === 0 &&
    missingRankingListKeyCount === 0 &&
    preservedDataIssues.length === 0

  return {
    ok,
    organizationCount: organizations.length,
    organizationsWithLegacyFields,
    organizationsMissingCanonicalFields,
    missingRecommendationCount,
    missingRankingListKeyCount,
    preservedDataIssues,
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
          legacyFieldKeysChecked: LEGACY_STEWARDSHIP_FIELD_KEYS,
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
  const rawOrganizations = await readRawOrganizations()
  const beforeSnapshots = new Map(
    rawOrganizations.map((organization) => [organization.id, buildPreservedSnapshot(organization)]),
  )
  const migrationResult = await migrateOrganizations()
  const validationResult = await validateMigration(beforeCount, beforeSnapshots)

  console.log(
    JSON.stringify(
      {
        mode: "migrate",
        backupPath: migrationResult.backupPath,
        migratedCount: migrationResult.migratedCount,
        recommendationChanges: migrationResult.recommendationChanges,
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
