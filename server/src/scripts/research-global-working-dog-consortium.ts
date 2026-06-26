import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import {
  addOrganization,
  getOrganizations,
  readStoredOrganizations,
  saveOrganizations,
} from "../services/data-store-service.js"
import { syncDonationDerivedFields } from "../services/donation-service.js"
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

const ORG_NAME = "Global Working Dog Consortium"
const EIN = "33-4891889"
const now = new Date().toISOString()

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

function applyManualEnrichment(organization: Organization): void {
  organization.is501c3Verified = "N"
  organization.subcategory = "Working Dogs"
  organization.missionBucket = "Animal Rescue / Shelters"
  organization.manualOverlapGroupKey = "working-dogs-policy-advocacy"
  organization.manualOverlapGroupLabel = "Working Dogs / K9 Policy & Advocacy"

  const notesBase =
    "501(c)(4) social welfare organization per IRS subsection code 4 (ProPublica) and official website disclosure — not a 501(c)(3). IRS exempt status granted September 2025; no public Form 990 filings yet. | Public source location match: Surprise, AZ"
  organization.notes = organization.notes?.includes("501(c)(4)")
    ? organization.notes
    : notesBase

  organization.politicalInvolvementNotes =
    "GWDC is a 501(c)(4) organization focused on K9 policy advocacy, state/federal legislation tracking, and grassroots representative outreach (federal and state letter-writing tools on site). Leadership includes former Capitol Hill policy staff. Activity is issue-based (working dog welfare, handler support, retirement care, penalties for harming LE K9s) rather than partisan electoral campaigning; however c4 status means donations are not treated as standard charitable contributions for tax purposes."

  organization.accountabilityNotes =
    "EIN 33-4891889 confirmed via ProPublica Nonprofit Explorer (subsection code 4). Organization publicly identifies as a National 501(c)(4) nonprofit. No Form 990 or audited financial statements are publicly available yet (newly recognized exempt organization, ruling date September 2025). Website publishes board bios, legislation tracker, and a curated resource directory for K9 units."

  const impactNote = `Website impact research (https://www.globalworkingdog.org/):
Quantified outcomes and program scale documented on official site:
- Curated resource directory listing 40+ working-dog, K9 unit, and retired-handler assistance organizations across the U.S. (including vest grants, medical relief, and retirement support programs)
- State-by-state legislation tracker covering active laws and pending bills on LE K9 protection, emergency transport, and animal cruelty penalties
- Federal and state representative letter-writing tools for K9 policy advocacy
- Board leadership track record cited on site: former federal policy advisor; prior role providing ballistic vests to hundreds of law enforcement K9s; board treasurer bio cites 1,000+ K9 vehicle/residence sniffs, $10M+ currency seized in narcotics cases, and 100+ high-risk K9 deployments
- Inspiration stories document K9 Dennis (500+ deployments, 100+ suspects located, 25+ apprehensions) and retired K9 care advocacy following line-of-duty injuries
Source pages: https://www.globalworkingdog.org/about-us, https://www.globalworkingdog.org/resources, https://www.globalworkingdog.org/legislation`

  const existingImpact = String(organization.impactEvidenceNotes ?? "").trim()
  organization.impactEvidenceNotes = existingImpact.includes("globalworkingdog.org")
    ? existingImpact
    : impactNote

  organization.sourceMeta = {
    ...organization.sourceMeta,
    is501c3Verified: {
      sourceName: "ProPublica Nonprofit Explorer",
      fetchedAt: now,
      confidenceNote: "Subsection code 4 indicates 501(c)(4), not 501(c)(3).",
      sourceType: "ProPublica/Form 990",
      reliability: "high",
    },
    impactEvidenceNotes: {
      sourceName: "Website impact research",
      fetchedAt: now,
      confidenceNote: "Impact and program scale extracted from official GWDC website pages.",
      sourceType: "Organization website",
      reliability: "medium",
    },
    notes: {
      sourceName: "Manual research",
      fetchedAt: now,
      confidenceNote: "501(c)(4) status and filing gap documented from ProPublica and official disclosures.",
      sourceType: "Manual entry",
      reliability: "high",
    },
  }

  organization.lastRefreshedAt = now
}

async function main(): Promise<void> {
  const existing = await getOrganizations()
  const normalizedEin = EIN.replace(/\D/g, "")
  let orgId = existing.find((org) => String(org.ein ?? "").replace(/\D/g, "") === normalizedEin)?.id

  if (!orgId) {
    const org = await addOrganization({
      organizationName: ORG_NAME,
      category: "Animal",
      subcategory: "Working Dogs",
      ein: EIN,
      website: "https://www.globalworkingdog.org",
      is501c3Verified: "N",
      missionBucket: "Animal Rescue / Shelters",
      approximateAnnualDonation: 0,
    })
    orgId = org.id
    console.log(`Added: ${org.organizationName} (${orgId})`)
  } else {
    console.log(`Already exists: ${ORG_NAME} (${orgId})`)
  }

  console.log("\n--- Adapter research ---")
  const researched = await researchOrganizationById(orgId)
  console.log(`Research status: ${researched?.researchStatus}`)

  console.log("\n--- Website impact scrape ---")
  await runWebsiteScrape()

  const organizations = await readStoredOrganizations()
  const organization = organizations.find((org) => org.id === orgId)
  if (!organization) throw new Error("Organization not found after research.")

  applyManualEnrichment(organization)
  const ranked = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(ranked)

  const final = ranked.find((org) => org.id === orgId)
  console.log("\n--- Final summary ---")
  console.log(
    JSON.stringify(
      {
        name: final?.organizationName,
        ein: final?.ein,
        stewardship: final?.stewardshipScore,
        recommendation: final?.recommendation,
        rankingStatus: final?.rankingStatus,
        impact: final?.impactEvidenceLevel,
        legal: final?.legalVerificationStatus,
        is501c3: final?.is501c3Verified,
        listRank: final?.listObjectiveRank,
        globalRank: final?.globalObjectiveRank,
        research: final?.researchStatus,
        redFlags: final?.redFlags,
      },
      null,
      2,
    ),
  )
  console.log(`\nTotal organizations: ${ranked.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
