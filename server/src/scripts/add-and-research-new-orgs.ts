import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { addOrganization, getOrganizations, readStoredOrganizations, saveOrganizations } from "../services/data-store-service.js"
import { syncDonationDerivedFields } from "../services/donation-service.js"
import { researchFinancialsFromForm990s } from "../services/financial-research-service.js"
import { researchFromAnnualReportPdfs } from "../services/annual-report-research-service.js"
import { researchOrganizationById } from "../services/research-service.js"
import { rankOrganizations } from "../services/ranking-service.js"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const currentDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(currentDirectory, "..", "..", "..")
const envPath = resolve(currentDirectory, "..", "..", ".env")
if (existsSync(envPath)) {
  loadEnv({ path: envPath })
}

import type { MissionBucket } from "../types/organization.js"

const NEW_ORGS: Array<{
  organizationName: string
  category: string
  ein: string
  website: string
  is501c3Verified: string
  missionBucket: MissionBucket
  approximateAnnualDonation: number
}> = [
  {
    organizationName: "The Humane League",
    category: "Animal",
    ein: "04-3817491",
    website: "https://thehumaneleague.org",
    is501c3Verified: "Y",
    missionBucket: "Animal Rescue / Shelters" as const,
    approximateAnnualDonation: 0,
  },
  {
    organizationName: "American Fondouk",
    category: "Animal",
    ein: "04-6043108",
    website: "https://www.fondouk.org",
    is501c3Verified: "Y",
    missionBucket: "Veterinary / Medical Animal Care" as const,
    approximateAnnualDonation: 0,
  },
  {
    organizationName: "Companion Animal Protection Society",
    category: "Animal",
    ein: "58-2040413",
    website: "https://www.caps-web.org",
    is501c3Verified: "Y",
    missionBucket: "Animal Rescue / Shelters" as const,
    approximateAnnualDonation: 0,
  },
  {
    organizationName: "American Anti-Vivisection Society",
    category: "Animal",
    ein: "23-0341990",
    website: "https://www.aavs.org",
    is501c3Verified: "Y",
    missionBucket: "Animal Rescue / Shelters" as const,
    approximateAnnualDonation: 0,
  },
]

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

async function runWebsiteScrape(orgNames: string[]): Promise<void> {
  const scriptPath = resolve(projectRoot, "scripts", "scrape_website_impact.py")
  const { stdout, stderr } = await execFileAsync(
    "python3",
    [scriptPath, "--apply", "--delay", "0.25", "--org-names", ...orgNames],
    { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024, timeout: 15 * 60 * 1000 },
  )
  console.log(stdout)
  if (stderr) console.error(stderr)
}

async function main(): Promise<void> {
  const existing = await getOrganizations()
  const addedIds: string[] = []

  for (const input of NEW_ORGS) {
    const normalizedInputEin = input.ein.replace(/\D/g, "")
    const alreadyExists = existing.some(
      (org) => String(org.ein ?? "").replace(/\D/g, "") === normalizedInputEin,
    )
    if (alreadyExists) {
      console.log(`Already exists: ${input.organizationName}`)
      const match = existing.find((org) => String(org.ein ?? "").replace(/\D/g, "") === normalizedInputEin)
      if (match) addedIds.push(match.id)
      continue
    }
    const org = await addOrganization(input)
    console.log(`Added: ${org.organizationName} (${org.id})`)
    addedIds.push(org.id)
  }

  console.log("\n--- Form 990 financial ratios ---")
  const financials = await researchFinancialsFromForm990s({ missingOnly: false })
  console.log(financials.message)

  console.log("\n--- Form 990 Part III impact ---")
  await runImpact990Extract()

  console.log("\n--- Annual report PDFs ---")
  const annual = await researchFromAnnualReportPdfs()
  console.log(annual.message)

  console.log("\n--- Adapter research ---")
  for (const id of addedIds) {
    const org = await researchOrganizationById(id)
    console.log(`Researched: ${org?.organizationName ?? id} -> ${org?.researchStatus}`)
  }

  console.log("\n--- Website impact scrape ---")
  await runWebsiteScrape(NEW_ORGS.map((org) => org.organizationName))

  const organizations = await readStoredOrganizations()
  const ranked = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(ranked)

  console.log("\n--- Final summary ---")
  for (const name of NEW_ORGS.map((org) => org.organizationName)) {
    const org = ranked.find((item) => item.organizationName === name)
    if (!org) continue
    console.log(
      JSON.stringify({
        name: org.organizationName,
        stewardship: org.stewardshipScore,
        recommendation: org.recommendation,
        impact: org.impactEvidenceLevel,
        program: org.programPercent,
        rankingStatus: org.rankingStatus,
        listRank: org.listObjectiveRank,
        globalRank: org.globalObjectiveRank,
        ace: org.aceRecommendation,
      }),
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
