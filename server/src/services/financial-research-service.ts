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
const financialScriptPath = resolve(projectRoot, "scripts", "extract_form_990_batch.py")

export interface FinancialResearchResult {
  processed: number
  applied: number
  skipped: number
  errors: number
  fetchedAt: string
  message: string
}

function parseSummary(stdout: string): Partial<FinancialResearchResult> {
  const appliedMatch = stdout.match(/Applied updates for:\s*(.+)/)
  const skippedMatches = stdout.match(/Skipped [^:]+:/g)

  return {
    applied: appliedMatch && appliedMatch[1].trim() !== "none" ? appliedMatch[1].split(",").length : 0,
    skipped: skippedMatches?.length ?? 0,
  }
}

export async function researchFinancialsFromForm990s(options?: {
  missingOnly?: boolean
}): Promise<FinancialResearchResult> {
  const args = [financialScriptPath, "--apply"]
  if (options?.missingOnly !== false) args.push("--missing-only")

  const { stdout, stderr } = await execFileAsync("python3", args, {
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024,
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
    errors: summary.errors ?? 0,
    fetchedAt: new Date().toISOString(),
    message:
      applied > 0
        ? `Updated financial ratios for ${applied} organizations from Form 990 PDFs.`
        : "No new financial ratios were applied. PDFs may be missing or filings lack Part IX expense lines.",
  }
}
