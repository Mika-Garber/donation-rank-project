import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { readStoredOrganizations, saveOrganizations } from "../services/data-store-service.js"
import { syncDonationDerivedFields } from "../services/donation-service.js"
import { researchFinancialsFromForm990s } from "../services/financial-research-service.js"
import { researchOrganizationById } from "../services/research-service.js"
import { rankOrganizations } from "../services/ranking-service.js"
import type { Organization } from "../types/organization.js"

const execFileAsync = promisify(execFile)
const currentDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(currentDirectory, "..", "..", "..")
const envPath = resolve(currentDirectory, "..", "..", ".env")
if (existsSync(envPath)) {
  loadEnv({ path: envPath })
}

const ORG_NAME = "HHART (Halfway Home Animal Rescue Team)"
const ORG_ID = "73fa83eb-cc09-413c-9a6d-a965c4a5913a"
const now = new Date().toISOString()

async function runImpact990Extract(): Promise<void> {
  const scriptPath = resolve(projectRoot, "scripts", "extract_form_990_impact.py")
  const { stdout, stderr } = await execFileAsync(
    "python3",
    [scriptPath, "--apply", "--merge-manual"],
    { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 },
  )
  console.log(stdout)
  if (stderr) console.error(stderr)
}

async function runWebsiteScrape(): Promise<void> {
  const scriptPath = resolve(projectRoot, "scripts", "scrape_website_impact.py")
  const { stdout, stderr } = await execFileAsync(
    "python3",
    [scriptPath, "--apply", "--delay", "0.25", "--org-names", ORG_NAME],
    { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024, timeout: 10 * 60 * 1000 },
  )
  console.log(stdout)
  if (stderr) console.error(stderr)
}

function applyManualEnrichment(organization: Organization): Organization {
  const note =
    "Manual Form 990 extraction (TY2025): Program 97.6%, Fundraising 0.0%, Admin 2.4% from full filing PDF (Halfway Home Animal Rescue Team A Nj Nonprofit Corporation - Full Filing - Nonprofit Explorer - ProPublica.pdf)."
  const existingNotes = String(organization.notes ?? "").trim()
  const notes = existingNotes.includes("Manual Form 990 extraction") ? existingNotes : existingNotes ? `${existingNotes} | ${note}` : note

  const websiteAppend = `Additional research: official website (https://www.hharteam.org/) — quantified outcomes:
- 1,000+ animals saved since founding in 2019
- 26,008+ pounds of cat and dog food collected for the Feed Our Friends community food bank program
- Foster-based rescue serving Northern New Jersey with spay/neuter and medical assistance programs`

  const existingImpact = String(organization.impactEvidenceNotes ?? "").trim()
  const impactEvidenceNotes = existingImpact.includes("hharteam.org")
    ? existingImpact
    : existingImpact
      ? `${existingImpact}\n\n${websiteAppend}`
      : websiteAppend

  return {
    ...organization,
    website: organization.website?.trim() || "https://www.hharteam.org",
    subcategory: organization.subcategory?.trim() || "Dogs",
    is501c3Verified: "Y",
    programPercent: organization.programPercent ?? 97.6,
    fundraisingPercent: organization.fundraisingPercent ?? 0,
    adminPercent: organization.adminPercent ?? 2.4,
    politicalInvolvementNotes:
      organization.politicalInvolvementNotes?.trim() ||
      "Foster-based animal rescue focused on direct care, adoptions, spay/neuter assistance, and a community pet food bank (Feed Our Friends). No significant partisan political activity identified; mission is hands-on rescue and community support.",
    accountabilityNotes:
      organization.accountabilityNotes?.trim() ||
      "EIN 83-4402588 confirmed via ProPublica/Form 990. NJ Public Charity Registration CH4300100 per official website. Form 990 TY2025 shows 97.6% program expenses. All-volunteer foster-based organization founded 2019.",
    notes,
    impactEvidenceNotes,
    lastRefreshedAt: now,
    sourceMeta: {
      ...organization.sourceMeta,
      programPercent: {
        sourceName: "Form 990 PDF extraction",
        fetchedAt: now,
        confidenceNote: "Ratios extracted directly from uploaded full filing PDF (TY2025).",
        sourceType: "ProPublica/Form 990",
        reliability: "high",
      },
      fundraisingPercent: {
        sourceName: "Form 990 PDF extraction",
        fetchedAt: now,
        confidenceNote: "Ratios extracted directly from uploaded full filing PDF (TY2025).",
        sourceType: "ProPublica/Form 990",
        reliability: "high",
      },
      adminPercent: {
        sourceName: "Form 990 PDF extraction",
        fetchedAt: now,
        confidenceNote: "Ratios extracted directly from uploaded full filing PDF (TY2025).",
        sourceType: "ProPublica/Form 990",
        reliability: "high",
      },
      is501c3Verified: {
        sourceName: "ProPublica Nonprofit Explorer",
        fetchedAt: now,
        confidenceNote: "Subsection code indicates 501(c)(3).",
        sourceType: "ProPublica/Form 990",
        reliability: "high",
      },
      website: {
        sourceName: "Manual research",
        fetchedAt: now,
        confidenceNote: "Official website confirmed at hharteam.org.",
        sourceType: "Organization website",
        reliability: "high",
      },
      notes: {
        sourceName: "Manual research",
        fetchedAt: now,
        confidenceNote: "Form 990 TY2025 financial ratios applied from uploaded PDF.",
        sourceType: "Manual entry",
        reliability: "high",
      },
    },
  }
}

async function main(): Promise<void> {
  let organizations = await readStoredOrganizations()
  const index = organizations.findIndex((org) => org.id === ORG_ID || org.organizationName === ORG_NAME)
  if (index < 0) throw new Error("HHART organization not found.")

  organizations[index] = {
    ...organizations[index],
    website: "https://www.hharteam.org",
    subcategory: "Dogs",
  }
  await saveOrganizations(rankOrganizations(organizations.map(syncDonationDerivedFields)))

  console.log("--- Form 990 financial ratios ---")
  const financials = await researchFinancialsFromForm990s({ missingOnly: false })
  console.log(financials.message)

  console.log("\n--- Form 990 Part III impact ---")
  await runImpact990Extract()

  console.log("\n--- Adapter research ---")
  const researched = await researchOrganizationById(ORG_ID)
  console.log(`Research status: ${researched?.researchStatus}`)

  console.log("\n--- Website impact scrape ---")
  await runWebsiteScrape()

  organizations = await readStoredOrganizations()
  const orgIndex = organizations.findIndex((org) => org.id === ORG_ID)
  organizations[orgIndex] = applyManualEnrichment(organizations[orgIndex])

  const ranked = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(ranked)

  const final = ranked.find((org) => org.id === ORG_ID)
  console.log("\n--- Final summary ---")
  console.log(
    JSON.stringify(
      {
        name: final?.organizationName,
        stewardship: final?.stewardshipScore,
        recommendation: final?.recommendation,
        rankingStatus: final?.rankingStatus,
        impact: final?.impactEvidenceLevel,
        program: final?.programPercent,
        listRank: final?.listObjectiveRank,
        globalRank: final?.globalObjectiveRank,
        research: final?.researchStatus,
        legal: final?.legalVerificationStatus,
        charityNavigator: final?.charityNavigatorRating,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
