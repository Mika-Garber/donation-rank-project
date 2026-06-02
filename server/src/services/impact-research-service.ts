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
const impactScriptPath = resolve(projectRoot, "scripts", "extract_form_990_impact.py")

export interface ImpactResearchResult {
  processed: number
  applied: number
  skipped: number
  merged: number
  errors: number
  fetchedAt: string
  message: string
}

function parseSummary(stdout: string): Partial<ImpactResearchResult> {
  const appliedMatch = stdout.match(/Applied impact notes for (\d+) organizations/)
  const skippedMatch = stdout.match(/Skipped (\d+) files/)
  const summaryMatch = stdout.match(/\{\s*"processed":\s*(\d+),\s*"success":\s*(\d+),\s*"errors":\s*(\d+)\s*\}/)
  const mergedMatch = stdout.match(/Merged impact notes for (\d+) organizations/)

  return {
    processed: summaryMatch ? Number(summaryMatch[1]) : 0,
    applied: appliedMatch ? Number(appliedMatch[1]) : 0,
    skipped: skippedMatch ? Number(skippedMatch[1]) : 0,
    merged: mergedMatch ? Number(mergedMatch[1]) : 0,
    errors: summaryMatch ? Number(summaryMatch[3]) : 0,
  }
}

export async function researchImpactFromForm990s(options?: {
  force?: boolean
  mergeManualNotes?: boolean
}): Promise<ImpactResearchResult> {
  const args = [impactScriptPath, "--apply"]
  if (options?.force) args.push("--force")
  if (options?.mergeManualNotes !== false) args.push("--merge-manual")

  const { stdout, stderr } = await execFileAsync("python3", args, {
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024,
  })

  const organizations = await readStoredOrganizations()
  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(rankedOrganizations)

  const summary = parseSummary(`${stdout}\n${stderr}`)
  const applied = summary.applied ?? 0
  const merged = summary.merged ?? 0
  const skipped = summary.skipped ?? 0

  return {
    processed: summary.processed ?? 0,
    applied,
    skipped,
    merged,
    errors: summary.errors ?? 0,
    fetchedAt: new Date().toISOString(),
    message:
      applied + merged > 0
        ? `Updated impact evidence for ${applied + merged} organizations from Form 990 Part III PDFs.`
        : "No new impact notes were applied. Check skipped PDFs or existing notes.",
  }
}
