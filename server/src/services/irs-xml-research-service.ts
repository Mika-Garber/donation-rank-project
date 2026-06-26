import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readStoredOrganizations, saveOrganizations } from "./data-store-service.js"
import { syncDonationDerivedFields } from "./donation-service.js"
import { rankOrganizations } from "./ranking-service.js"

const execFileAsync = promisify(execFile)
const currentDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(currentDirectory, "..", "..", "..")
const irsXmlScriptPath = resolve(projectRoot, "scripts", "extract_from_irs_xml.py")

export interface IrsXmlResearchResult {
  indexedFilings: number
  processed: number
  financialApplied: number
  impactApplied: number
  impactMerged: number
  skipped: number
  failed: number
  fetchedAt: string
  message: string
}

function parseSummary(stdout: string): Partial<IrsXmlResearchResult> {
  const match = stdout.match(
    /\{\s*"indexedFilings":\s*(\d+),\s*"processed":\s*(\d+),\s*"financialApplied":\s*(\d+),\s*"impactApplied":\s*(\d+),\s*"impactMerged":\s*(\d+),\s*"skipped":\s*(\d+),\s*"failed":\s*(\d+)\s*\}/,
  )
  if (!match) return {}
  return {
    indexedFilings: Number(match[1]),
    processed: Number(match[2]),
    financialApplied: Number(match[3]),
    impactApplied: Number(match[4]),
    impactMerged: Number(match[5]),
    skipped: Number(match[6]),
    failed: Number(match[7]),
  }
}

export async function researchFromIrsXml(options?: {
  missingFinancialsOnly?: boolean
  mergeManualImpactNotes?: boolean
}): Promise<IrsXmlResearchResult> {
  const args = [
    irsXmlScriptPath,
    "--apply",
    "--financials",
    "--impact",
    ...(options?.missingFinancialsOnly !== false ? ["--missing-financials-only"] : []),
    ...(options?.mergeManualImpactNotes !== false ? ["--merge-manual"] : []),
  ]

  const { stdout, stderr } = await execFileAsync("python3", args, {
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30 * 60 * 1000,
  })

  const organizations = await readStoredOrganizations()
  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(rankedOrganizations)

  const summary = parseSummary(`${stdout}\n${stderr}`)
  const financialApplied = summary.financialApplied ?? 0
  const impactApplied = (summary.impactApplied ?? 0) + (summary.impactMerged ?? 0)

  return {
    indexedFilings: summary.indexedFilings ?? 0,
    processed: summary.processed ?? 0,
    financialApplied,
    impactApplied: summary.impactApplied ?? 0,
    impactMerged: summary.impactMerged ?? 0,
    skipped: summary.skipped ?? 0,
    failed: summary.failed ?? 0,
    fetchedAt: new Date().toISOString(),
    message:
      financialApplied > 0 || impactApplied > 0
        ? `IRS XML research updated ${financialApplied} financial records and ${impactApplied} impact notes.`
        : "IRS XML research completed with no new financial or impact updates.",
  }
}
