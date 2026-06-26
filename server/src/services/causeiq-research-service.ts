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
const causeIqScriptPath = resolve(projectRoot, "scripts", "research_causeiq.py")

export interface CauseIqResearchResult {
  processed: number
  applied: number
  skipped: number
  failed: number
  apiMode: boolean
  fetchedAt: string
  message: string
}

function parseSummary(stdout: string): Omit<CauseIqResearchResult, "fetchedAt" | "message"> {
  const match = stdout.match(
    /\{\s*"processed":\s*(\d+),\s*"applied":\s*(\d+),\s*"skipped":\s*(\d+),\s*"failed":\s*(\d+),\s*"apiMode":\s*(true|false)/,
  )
  if (!match) {
    return { processed: 0, applied: 0, skipped: 0, failed: 0, apiMode: false }
  }
  return {
    processed: Number(match[1]),
    applied: Number(match[2]),
    skipped: Number(match[3]),
    failed: Number(match[4]),
    apiMode: match[5] === "true",
  }
}

export async function researchFromCauseIq(options?: {
  onlyWithoutAnnualPdf?: boolean
  refreshBroken?: boolean
}): Promise<CauseIqResearchResult> {
  const args = [causeIqScriptPath, "--apply", "--delay", "0.35"]
  if (options?.onlyWithoutAnnualPdf !== false) {
    args.push("--only-without-annual-pdf")
  }
  if (options?.refreshBroken) {
    args.push("--refresh-broken")
  }

  const { stdout, stderr } = await execFileAsync("python3", args, {
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 60 * 60 * 1000,
    env: {
      ...process.env,
    },
  })

  const organizations = await readStoredOrganizations()
  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(rankedOrganizations)

  const summary = parseSummary(`${stdout}\n${stderr}`)
  const message =
    summary.applied > 0
      ? `Cause IQ research enriched ${summary.applied} organizations${summary.apiMode ? " (API mode)" : " (public profiles)"}.`
      : "Cause IQ research completed with no new organization updates."

  return {
    ...summary,
    fetchedAt: new Date().toISOString(),
    message,
  }
}
