import type { Organization, RefreshResult, ResearchError, ResearchStatus } from "../types/organization.js"
import { getOrganizations, updateOrganizations, writeRefreshLog } from "./data-store-service.js"
import { getResearchStatusFromFields } from "./research-requirements.js"
import { charityNavigatorAdapter } from "./source-adapters/charity-navigator-adapter.js"
import { charityWatchAdapter } from "./source-adapters/charitywatch-adapter.js"
import { aceAdapter } from "./source-adapters/ace-adapter.js"
import type { ResearchAdapter, ResearchPatch } from "./source-adapters/adapter-types.js"
import { proPublicaAdapter } from "./source-adapters/public-nonprofit-adapter.js"
import { websiteDiscoveryAdapter } from "./source-adapters/website-discovery-adapter.js"

const researchAdapters: ResearchAdapter[] = [
  proPublicaAdapter,
  websiteDiscoveryAdapter,
  charityNavigatorAdapter,
  charityWatchAdapter,
  aceAdapter,
]
const PRIMARY_RESEARCH_SOURCES = new Set<string>(["ProPublica Nonprofit Explorer"])

function mergePatch(organization: Organization, patch: ResearchPatch): Organization {
  const notesPatch = patch.organizationPatch.notes
  const incomingNotesSourceMeta = patch.sourceMetaPatch.notes
  const existingNotesSourceMeta = organization.sourceMeta?.notes
  const hasManualNotes =
    toSafeString(organization.notes).trim().length > 0 &&
    Boolean(existingNotesSourceMeta) &&
    (existingNotesSourceMeta.sourceName.toLowerCase().includes("manual") ||
      existingNotesSourceMeta.confidenceNote.toLowerCase().includes("manual"))
  const incomingIsHigherConfidence = Boolean(incomingNotesSourceMeta?.confidenceNote.toLowerCase().includes("high"))
  const shouldKeepExistingNotes = hasManualNotes && typeof notesPatch === "string" && !incomingIsHigherConfidence

  const sanitizedOrganizationPatch = {
    ...patch.organizationPatch,
    ...(shouldKeepExistingNotes ? { notes: organization.notes } : {}),
  }

  return {
    ...organization,
    ...sanitizedOrganizationPatch,
    sourceMeta: {
      ...organization.sourceMeta,
      ...patch.sourceMetaPatch,
    },
  }
}

function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return String(value)
}

function buildResearchErrors(adapterName: string, errors: string[]): ResearchError[] {
  return errors.map((message) => ({
    sourceName: adapterName,
    message,
    occurredAt: new Date().toISOString(),
  }))
}

function isNonFatalNetworkError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("econnrefused") ||
    normalized.includes("econnreset") ||
    normalized.includes("enotfound") ||
    normalized.includes("timed out")
  )
}

function isFatalResearchError(error: ResearchError): boolean {
  if (!PRIMARY_RESEARCH_SOURCES.has(error.sourceName)) return false
  return !isNonFatalNetworkError(error.message)
}

function determineStatus(organization: Organization, errors: ResearchError[], nextAttemptCount: number): ResearchStatus {
  const derivedStatus = getResearchStatusFromFields(organization, organization.researchStatus)
  if (derivedStatus === "complete") return "complete"
  if (derivedStatus === "partial") return "partial"
  if (errors.length === 0) return nextAttemptCount > 0 ? "not_started" : "not_started"

  const hasFatalError = errors.some((error) => isFatalResearchError(error))
  if (hasFatalError) return "failed"

  return "not_started"
}

export async function researchOrganizationById(id: string): Promise<Organization | null> {
  const organizations = await getOrganizations()
  const organizationIndex = organizations.findIndex((item) => item.id === id)
  if (organizationIndex < 0) return null

  let currentOrganization = organizations[organizationIndex]
  let changedFieldCount = 0
  const researchErrors: ResearchError[] = []

  for (const adapter of researchAdapters) {
    const patch = await adapter.enrichOrganization(currentOrganization)
    changedFieldCount += patch.changedFields.length
    currentOrganization = mergePatch(currentOrganization, patch)
    researchErrors.push(...buildResearchErrors(adapter.sourceName, patch.errors))
  }

  currentOrganization = {
    ...currentOrganization,
    researchAttempts: currentOrganization.researchAttempts + 1,
    researchErrors: researchErrors.slice(0, 10),
    researchStatus: determineStatus(currentOrganization, researchErrors, currentOrganization.researchAttempts + 1),
    lastRefreshedAt: new Date().toISOString(),
  }

  organizations[organizationIndex] = currentOrganization
  await updateOrganizations(organizations)
  return changedFieldCount >= 0 ? currentOrganization : null
}

export async function researchAllOrganizations(): Promise<RefreshResult> {
  const organizations = await getOrganizations()
  const updatedOrganizations: Organization[] = []
  const changedOrganizations: string[] = []
  const failedOrganizations: string[] = []
  let changedFieldsCount = 0

  for (const organization of organizations) {
    let currentOrganization = organization
    let orgChangedFields = 0
    const researchErrors: ResearchError[] = []

    for (const adapter of researchAdapters) {
      const patch = await adapter.enrichOrganization(currentOrganization)
      orgChangedFields += patch.changedFields.length
      currentOrganization = mergePatch(currentOrganization, patch)
      researchErrors.push(...buildResearchErrors(adapter.sourceName, patch.errors))
    }

    currentOrganization = {
      ...currentOrganization,
      researchAttempts: currentOrganization.researchAttempts + 1,
      researchErrors: researchErrors.slice(0, 10),
      researchStatus: determineStatus(currentOrganization, researchErrors, currentOrganization.researchAttempts + 1),
      lastRefreshedAt: new Date().toISOString(),
    }

    changedFieldsCount += orgChangedFields
    if (orgChangedFields > 0) changedOrganizations.push(currentOrganization.organizationName)
    if (currentOrganization.researchStatus === "failed") failedOrganizations.push(currentOrganization.organizationName)

    updatedOrganizations.push(currentOrganization)
  }

  await updateOrganizations(updatedOrganizations)

  const refreshResult: RefreshResult = {
    updatedCount: changedOrganizations.length,
    changedFieldsCount,
    fetchedAt: new Date().toISOString(),
    changedOrganizations,
    failedOrganizations,
    processedCount: updatedOrganizations.length,
  }
  await writeRefreshLog(refreshResult as unknown as Record<string, unknown>)
  return refreshResult
}
