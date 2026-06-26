import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readStoredOrganizations, saveOrganizations } from "./data-store-service.js"
import { syncDonationDerivedFields } from "./donation-service.js"
import { researchFromCauseIq, type CauseIqResearchResult } from "./causeiq-research-service.js"
import { researchFromAnnualReportPdfs, type AnnualReportResearchResult } from "./annual-report-research-service.js"
import { researchFromIrsXml } from "./irs-xml-research-service.js"
import { rankOrganizations } from "./ranking-service.js"
import { researchAllOrganizations } from "./research-service.js"
import { regenerateRemainingImpactReportsList } from "./research-finalize-service.js"

const execFileAsync = promisify(execFile)
const currentDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(currentDirectory, "..", "..", "..")
const websiteImpactScriptPath = resolve(projectRoot, "scripts", "scrape_website_impact.py")

export interface WebsiteImpactResearchResult {
  processed: number
  applied: number
  failed: number
  message: string
}

export interface FreeResearchResult {
  fetchedAt: string
  refresh: Awaited<ReturnType<typeof researchAllOrganizations>>
  irsXml: Awaited<ReturnType<typeof researchFromIrsXml>>
  annualReports: AnnualReportResearchResult
  causeIq: CauseIqResearchResult
  websiteImpact: WebsiteImpactResearchResult
  remainingImpactReports: { organizationCount: number; message: string }
  message: string
}

function parseWebsiteImpactSummary(stdout: string): WebsiteImpactResearchResult {
  const match = stdout.match(
    /\{\s*"processed":\s*(\d+),\s*"applied":\s*(\d+),\s*"skipped":\s*(\d+),\s*"failed":\s*(\d+)/,
  )
  if (!match) {
    return { processed: 0, applied: 0, failed: 0, message: "Website impact scrape did not return a summary." }
  }
  const applied = Number(match[2])
  const failed = Number(match[4])
  return {
    processed: Number(match[1]),
    applied,
    failed,
    message:
      applied > 0
        ? `Website scrape added impact notes for ${applied} organizations.`
        : "Website scrape found no new quantified impact notes.",
  }
}

async function researchWebsiteImpact(options?: { onlyWithoutAnnualPdf?: boolean }): Promise<WebsiteImpactResearchResult> {
  const args = [websiteImpactScriptPath, "--apply", "--delay", "0.25"]
  if (options?.onlyWithoutAnnualPdf !== false) {
    args.push("--only-without-annual-pdf")
  }

  const { stdout, stderr } = await execFileAsync("python3", args, {
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 45 * 60 * 1000,
  })

  const organizations = await readStoredOrganizations()
  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(rankedOrganizations)

  return parseWebsiteImpactSummary(`${stdout}\n${stderr}`)
}

export async function runAllFreeResearch(): Promise<FreeResearchResult> {
  const refresh = await researchAllOrganizations()
  const irsXml = await researchFromIrsXml({ missingFinancialsOnly: true, mergeManualImpactNotes: true })
  const annualReports = await researchFromAnnualReportPdfs()
  const causeIq = await researchFromCauseIq({ onlyWithoutAnnualPdf: true })
  const websiteImpact = await researchWebsiteImpact({ onlyWithoutAnnualPdf: true })
  const remainingImpactReports = await regenerateRemainingImpactReportsList()

  const message = [
    `Refreshed ${refresh.processedCount} organizations (${refresh.updatedCount} changed).`,
    irsXml.message,
    annualReports.message,
    causeIq.message,
    websiteImpact.message,
    remainingImpactReports.message,
  ].join(" ")

  return {
    fetchedAt: new Date().toISOString(),
    refresh,
    irsXml,
    annualReports,
    causeIq,
    websiteImpact,
    remainingImpactReports,
    message,
  }
}
