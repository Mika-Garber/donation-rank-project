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

const ORG_NAME = "Outcast Rescue"
const ORG_ID = "edef9770-32c9-4e06-a6d3-6567386bf143"
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
    "Manual Form 990 extraction (TY2024): Program 100%, Fundraising 0%, Admin 0% from full filing PDF (Outcast Rescue - Full Filing - Nonprofit Explorer - ProPublica.pdf). Part IX line 25: $267,323 program service expenses, $0 management and general, $0 fundraising."
  const existingNotes = String(organization.notes ?? "").trim()
  const notes = existingNotes.includes("Manual Form 990 extraction") ? existingNotes : existingNotes ? `${existingNotes} | ${note}` : note

  const websiteAppend = `Additional research: official website (https://www.outcastrescue.com) and Form 990 TY2024:
- All-volunteer pit bull and rottweiler rescue based in Catasauqua, PA (formed 2016)
- ~75 volunteers; no paid staff in TY2024
- Gross receipts $248,764; program service expenses $267,323 (100% program per Part IX functional expense columns)
- Mission: advocate for misjudged breeds, take severe abuse cases, medical care, spay/neuter, and adoptions`

  const existingImpact = String(organization.impactEvidenceNotes ?? "").trim()
  const impactEvidenceNotes = existingImpact.includes("outcastrescue.com")
    ? existingImpact
    : existingImpact
      ? `${existingImpact}\n\n${websiteAppend}`
      : websiteAppend

  return {
    ...organization,
    website: organization.website?.trim() || "https://www.outcastrescue.com",
    subcategory: organization.subcategory?.trim() || "Dogs",
    is501c3Verified: "Y",
    programPercent: organization.programPercent ?? 100,
    fundraisingPercent: organization.fundraisingPercent ?? 0,
    adminPercent: organization.adminPercent ?? 0,
    politicalInvolvementNotes:
      organization.politicalInvolvementNotes?.trim() ||
      "Volunteer-run dog rescue focused on pit bulls and rottweilers — direct foster/adoption care, spay/neuter, and medical rehabilitation. No significant partisan political activity identified; mission is hands-on animal rescue and breed advocacy.",
    accountabilityNotes:
      organization.accountabilityNotes?.trim() ||
      "EIN 81-2867688 confirmed via ProPublica/Form 990 TY2024. Form 990 shows 100% program expenses (Part IX columns B–D: $267,323 program, $0 management, $0 fundraising). All-volunteer organization with 3 board members. Financial statements not independently audited (Part XII).",
    notes,
    impactEvidenceNotes,
    lastRefreshedAt: now,
    sourceMeta: {
      ...organization.sourceMeta,
      programPercent: {
        sourceName: "Form 990 PDF extraction",
        fetchedAt: now,
        confidenceNote: "Ratios extracted directly from uploaded full filing PDF (TY2024).",
        sourceType: "ProPublica/Form 990",
        reliability: "high",
      },
      fundraisingPercent: {
        sourceName: "Form 990 PDF extraction",
        fetchedAt: now,
        confidenceNote: "Ratios extracted directly from uploaded full filing PDF (TY2024).",
        sourceType: "ProPublica/Form 990",
        reliability: "high",
      },
      adminPercent: {
        sourceName: "Form 990 PDF extraction",
        fetchedAt: now,
        confidenceNote: "Ratios extracted directly from uploaded full filing PDF (TY2024).",
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
        confidenceNote: "Official website confirmed at outcastrescue.com (also listed on Form 990).",
        sourceType: "Organization website",
        reliability: "high",
      },
      notes: {
        sourceName: "Manual research",
        fetchedAt: now,
        confidenceNote: "Form 990 TY2024 financial ratios applied from uploaded PDF.",
        sourceType: "Manual entry",
        reliability: "high",
      },
    },
  }
}

async function main(): Promise<void> {
  let organizations = await readStoredOrganizations()
  const index = organizations.findIndex((org) => org.id === ORG_ID || org.organizationName === ORG_NAME)
  if (index < 0) throw new Error("Outcast Rescue organization not found.")

  organizations[index] = {
    ...organizations[index],
    website: "https://www.outcastrescue.com",
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
