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
const remainingListScriptPath = resolve(projectRoot, "scripts", "regenerate_remaining_impact_reports.py")

export async function regenerateRemainingImpactReportsList(): Promise<{ organizationCount: number; message: string }> {
  const { stdout, stderr } = await execFileAsync("python3", [remainingListScriptPath], {
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
  })

  const match = `${stdout}\n${stderr}`.match(/Remaining:\s*(\d+)/)
  const organizationCount = match ? Number(match[1]) : 0

  return {
    organizationCount,
    message: `Regenerated remaining impact report checklist (${organizationCount} organizations).`,
  }
}

export async function finalizeRankingAfterResearch(): Promise<void> {
  const organizations = await readStoredOrganizations()
  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(rankedOrganizations)
}
