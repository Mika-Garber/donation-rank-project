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
const annualReportScriptPath = resolve(projectRoot, "scripts", "extract_annual_report_impact.py")

export interface AnnualReportResearchResult {
  processed: number
  applied: number
  skipped: number
  withStats: number
  fetchedAt: string
  message: string
}

function parseSummary(stdout: string): Partial<AnnualReportResearchResult> {
  const match = stdout.match(
    /\{\s*"processed":\s*(\d+),\s*"withStats":\s*(\d+),\s*"applied":\s*(\d+),\s*"skipped":\s*(\d+)/,
  )
  if (!match) return {}
  return {
    processed: Number(match[1]),
    withStats: Number(match[2]),
    applied: Number(match[3]),
    skipped: Number(match[4]),
  }
}

export async function researchFromAnnualReportPdfs(): Promise<AnnualReportResearchResult> {
  const { stdout, stderr } = await execFileAsync("python3", [annualReportScriptPath, "--apply"], {
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 60 * 60 * 1000,
  })

  const organizations = await readStoredOrganizations()
  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(rankedOrganizations)

  const summary = parseSummary(`${stdout}\n${stderr}`)
  const applied = summary.applied ?? 0

  return {
    processed: summary.processed ?? 0,
    applied,
    skipped: summary.skipped ?? 0,
    withStats: summary.withStats ?? 0,
    fetchedAt: new Date().toISOString(),
    message:
      applied > 0
        ? `Annual report PDF extraction applied impact notes for ${applied} organizations.`
        : "No new annual report PDF impact notes were applied.",
  }
}
