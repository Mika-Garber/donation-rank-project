import { copyFile, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import type { DonationRecord, Organization } from "../types/organization.js"
import { isSupabaseConfigured } from "../config/supabase-config.js"
import {
  importDonationEntriesWithoutActivity,
  listAllDonationEntryIds,
} from "../services/supabase-shared-data-service.js"

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const ORGANIZATIONS_PATH = resolve(currentDirectory, "..", "..", "data", "organizations.json")
const SERVER_ENV_PATH = resolve(currentDirectory, "..", "..", ".env")

if (existsSync(SERVER_ENV_PATH)) {
  loadEnv({ path: SERVER_ENV_PATH })
}

const ESTIMATE_NOTE = "Imported from annual estimate — replace with actual gifts as you log them."

interface ImportCandidate {
  id: string
  organizationId: string
  organizationName: string
  date: string
  amount: number
  note: string
  source: "donations_array" | "approximate_annual_donation"
}

interface SkippedEntry {
  organizationName: string
  reason: string
  donation?: Pick<DonationRecord, "date" | "amount" | "note">
}

function formatBackupTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-")
}

function isRealDonation(donation: DonationRecord): boolean {
  const note = donation.note?.trim().toLowerCase() ?? ""
  if (!note) return false
  if (note.includes("test")) return false
  if (note.includes("imported from annual estimate")) return true
  if (note.includes("recent gift logged from client records")) return true
  return false
}

function isTestDonation(donation: DonationRecord): boolean {
  const note = donation.note?.trim().toLowerCase() ?? ""
  if (note.includes("test")) return true
  if (!note) return true
  return !isRealDonation(donation)
}

function buildCandidatesFromOrganization(organization: Organization): {
  candidates: ImportCandidate[]
  skipped: SkippedEntry[]
} {
  const candidates: ImportCandidate[] = []
  const skipped: SkippedEntry[] = []
  const donations = organization.donations ?? []

  for (const donation of donations) {
    if (isTestDonation(donation)) {
      skipped.push({
        organizationName: organization.organizationName,
        reason: "Excluded test or non-client donation entry",
        donation: {
          date: donation.date,
          amount: donation.amount,
          note: donation.note,
        },
      })
      continue
    }

    if (!donation.id || !donation.date || donation.amount <= 0) {
      skipped.push({
        organizationName: organization.organizationName,
        reason: "Invalid donation record",
        donation: {
          date: donation.date,
          amount: donation.amount,
          note: donation.note,
        },
      })
      continue
    }

    candidates.push({
      id: donation.id,
      organizationId: organization.id,
      organizationName: organization.organizationName,
      date: donation.date,
      amount: donation.amount,
      note: donation.note?.trim() ?? "",
      source: "donations_array",
    })
  }

  if (donations.length === 0 && (organization.approximateAnnualDonation ?? 0) > 0) {
    const year = new Date().getFullYear()
    candidates.push({
      id: `${organization.id}-annual-estimate-${year}`,
      organizationId: organization.id,
      organizationName: organization.organizationName,
      date: `${year}-01-01`,
      amount: organization.approximateAnnualDonation,
      note: ESTIMATE_NOTE,
      source: "approximate_annual_donation",
    })
  }

  return { candidates, skipped }
}

async function createOrganizationsBackup(): Promise<string> {
  const backupPath = resolve(
    currentDirectory,
    "..",
    "..",
    "data",
    `organizations.json.backup-pre-supabase-donation-import-${formatBackupTimestamp(new Date())}.json`,
  )
  await copyFile(ORGANIZATIONS_PATH, backupPath)
  return backupPath
}

async function readOrganizations(): Promise<Organization[]> {
  const raw = await readFile(ORGANIZATIONS_PATH, "utf8")
  return JSON.parse(raw) as Organization[]
}

function printCandidate(candidate: ImportCandidate): void {
  console.log(
    `  + ${candidate.organizationName} | ${candidate.date} | $${candidate.amount.toLocaleString()} | ${candidate.note.slice(0, 72)}`,
  )
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run")

  if (!isSupabaseConfigured()) {
    console.error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env")
    process.exit(1)
  }

  const backupPath = await createOrganizationsBackup()
  console.log(`Backup created: ${backupPath}`)

  const organizations = await readOrganizations()
  const existingIds = await listAllDonationEntryIds()

  let organizationsScanned = 0
  let donationEntriesFound = 0
  let donationEntriesAlreadyInSupabase = 0
  let donationEntriesToInsert = 0
  const skipped: SkippedEntry[] = []
  const toInsert: ImportCandidate[] = []

  for (const organization of organizations) {
    organizationsScanned += 1
    const { candidates, skipped: orgSkipped } = buildCandidatesFromOrganization(organization)
    skipped.push(...orgSkipped)
    donationEntriesFound += candidates.length

    for (const candidate of candidates) {
      if (existingIds.has(candidate.id)) {
        donationEntriesAlreadyInSupabase += 1
        continue
      }

      toInsert.push(candidate)
      donationEntriesToInsert += 1
    }
  }

  console.log("")
  console.log(`Mode: ${dryRun ? "DRY RUN" : "IMPORT"}`)
  console.log(`Organizations scanned: ${organizationsScanned}`)
  console.log(`Real donation entries found in JSON: ${donationEntriesFound}`)
  console.log(`Already in Supabase: ${donationEntriesAlreadyInSupabase}`)
  console.log(`To insert: ${donationEntriesToInsert}`)
  console.log(`Skipped: ${skipped.length}`)
  console.log("")

  if (toInsert.length > 0) {
    console.log("Entries to import:")
    for (const candidate of toInsert) {
      printCandidate(candidate)
    }
    console.log("")
  }

  if (skipped.length > 0) {
    console.log("Skipped entries:")
    for (const entry of skipped) {
      const detail = entry.donation
        ? `${entry.donation.date} | $${entry.donation.amount} | ${entry.donation.note || "(empty note)"}`
        : ""
      console.log(`  - ${entry.organizationName}: ${entry.reason}${detail ? ` (${detail})` : ""}`)
    }
    console.log("")
  }

  if (dryRun) {
    console.log("Dry run complete. Re-run without --dry-run to import.")
    return
  }

  if (toInsert.length === 0) {
    console.log("Nothing to import.")
    return
  }

  const inserted = await importDonationEntriesWithoutActivity(toInsert)
  console.log(`Inserted ${inserted} donation entries into Supabase.`)

  const verifyIds = await listAllDonationEntryIds()
  console.log(`Supabase donation_entries count after import: ${verifyIds.size}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
