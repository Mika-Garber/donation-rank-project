import type {
  AdvisorExportInput,
  DonationYearSummary,
  GivingPlanGroup,
  LegacyPlanResponse,
  PortfolioConcentrationResponse,
  PortfolioReviewResponse,
  Organization,
  OrganizationAddress,
  ResearchAuditResponse,
  RankingExplanation,
  RefreshResult,
  TriageQueueItem,
  WatchdogSetupStatus,
} from "../types/organization"
import type { ClientActivityEntry, SharedDataStatus } from "../types/shared-data"
import type { AdvisorExportRow } from "../utils/advisor-export"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api"
const APP_ACCESS_TOKEN = import.meta.env.VITE_APP_ACCESS_TOKEN ?? ""

function getActorHeaders(): Record<string, string> {
  const actorName = typeof window !== "undefined" ? window.sessionStorage.getItem("donation-rank-actor-name")?.trim() : ""
  if (!actorName) return {}
  return {
    "x-actor-name": actorName,
    "x-actor-type": "client",
  }
}

async function requestJson<TResponse>(path: string, options?: RequestInit): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(APP_ACCESS_TOKEN ? { "x-access-token": APP_ACCESS_TOKEN } : {}),
      ...getActorHeaders(),
      ...(options?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || "Request failed.")
  }

  return (await response.json()) as TResponse
}

export async function getOrganizations(): Promise<Organization[]> {
  const payload = await requestJson<{ organizations: Organization[] }>("/organizations")
  return payload.organizations
}

export async function getOrganizationById(id: string): Promise<{ organization: Organization; donationSummaries: DonationYearSummary[] }> {
  return requestJson<{ organization: Organization; donationSummaries: DonationYearSummary[] }>(`/organizations/${id}`)
}

export async function updateOrganizationAddress(id: string, address: OrganizationAddress): Promise<Organization> {
  const payload = await requestJson<{ organization: Organization }>(`/organizations/${id}/address`, {
    method: "PATCH",
    body: JSON.stringify(address),
  })
  return payload.organization
}

export async function updateOrganizationResearchNotes(
  id: string,
  input: {
    impactEvidenceNotes?: string
    accountabilityNotes?: string
    politicalInvolvementNotes?: string
  },
): Promise<Organization> {
  const payload = await requestJson<{ organization: Organization }>(`/organizations/${id}/research-notes`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return payload.organization
}

export async function updateOrganizationMissionOverlap(
  id: string,
  input: {
    duplicateMission?: string
    duplicateMissionGroup?: string
    duplicateMissionRole?: "" | "primary" | "secondary" | "phasing-out"
  },
): Promise<Organization> {
  const payload = await requestJson<{ organization: Organization }>(`/organizations/${id}/mission-overlap`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return payload.organization
}

export async function researchImpactFrom990s(input?: {
  force?: boolean
  mergeManualNotes?: boolean
}): Promise<{
  processed: number
  applied: number
  skipped: number
  merged: number
  errors: number
  fetchedAt: string
  message: string
}> {
  return requestJson("/organizations/research-impact-from-990s", {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  })
}

export async function runFreeResearch(): Promise<{
  fetchedAt: string
  message: string
  refresh: RefreshResult
  irsXml: {
    financialApplied: number
    impactApplied: number
    impactMerged: number
    failed: number
  }
}> {
  return requestJson("/organizations/run-free-research", {
    method: "POST",
  })
}

export async function addDonation(
  organizationId: string,
  input: { date: string; amount: number; note?: string },
): Promise<{ organization: Organization; donationSummaries: DonationYearSummary[] }> {
  return requestJson<{ organization: Organization; donationSummaries: DonationYearSummary[] }>(
    `/organizations/${organizationId}/donations`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
}

export async function updateDonation(
  organizationId: string,
  donationId: string,
  input: { date?: string; amount?: number; note?: string },
): Promise<{ organization: Organization; donationSummaries: DonationYearSummary[] }> {
  return requestJson<{ organization: Organization; donationSummaries: DonationYearSummary[] }>(
    `/organizations/${organizationId}/donations/${donationId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  )
}

export async function deleteDonation(
  organizationId: string,
  donationId: string,
): Promise<{ organization: Organization; donationSummaries: DonationYearSummary[] }> {
  return requestJson<{ organization: Organization; donationSummaries: DonationYearSummary[] }>(
    `/organizations/${organizationId}/donations/${donationId}`,
    {
      method: "DELETE",
    },
  )
}

export async function createOrganization(input: {
  organizationName: string
  ein?: string
  website?: string
  category: string
  subcategory: string
  approximateAnnualDonation: number
  notes: string
}): Promise<Organization> {
  const payload = await requestJson<{ organization: Organization }>("/organizations", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return payload.organization
}

export async function researchOrganization(id: string): Promise<Organization> {
  const payload = await requestJson<{ organization: Organization }>(`/organizations/${id}/research`, {
    method: "POST",
  })
  return payload.organization
}

export async function getRankingExplanation(): Promise<RankingExplanation> {
  return requestJson<RankingExplanation>("/ranking/explanation")
}

export async function getTriageQueue(limit = 20): Promise<TriageQueueItem[]> {
  const payload = await requestJson<{ triageQueue: TriageQueueItem[] }>(`/ranking/triage?limit=${limit}`)
  return payload.triageQueue
}

export async function getGivingPlan(): Promise<GivingPlanGroup[]> {
  const payload = await requestJson<{ groups: GivingPlanGroup[] }>("/ranking/giving-plan")
  return payload.groups
}

export async function getPortfolioReview(): Promise<PortfolioReviewResponse> {
  return requestJson<PortfolioReviewResponse>("/ranking/portfolio-review")
}

export async function getPortfolioConcentration(): Promise<PortfolioConcentrationResponse> {
  return requestJson<PortfolioConcentrationResponse>("/ranking/portfolio-concentration")
}

export async function getLegacyPlan(): Promise<LegacyPlanResponse> {
  return requestJson<LegacyPlanResponse>("/ranking/legacy-plan")
}

export async function getResearchAudit(): Promise<ResearchAuditResponse> {
  return requestJson<ResearchAuditResponse>("/ranking/research-audit")
}

export async function getWatchdogSetup(): Promise<WatchdogSetupStatus> {
  return requestJson<WatchdogSetupStatus>("/ranking/watchdog-setup")
}

export async function refreshOnlineData(): Promise<RefreshResult> {
  const payload = await requestJson<{ refreshResult: RefreshResult }>("/refresh", {
    method: "POST",
  })
  return payload.refreshResult
}

export async function updateOrganizationAdvisorExport(
  id: string,
  input: AdvisorExportInput,
): Promise<Organization> {
  const payload = await requestJson<{ organization: Organization }>(`/organizations/${id}/advisor-export`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return payload.organization
}

export async function updateOrganizationAdvisorExportBatch(
  items: Array<{ organizationId: string; input: AdvisorExportInput }>,
): Promise<{ savedCount: number }> {
  return requestJson<{ savedCount: number }>("/organizations/advisor-export/batch", {
    method: "POST",
    body: JSON.stringify({ items }),
  })
}

export async function researchAllOrganizationAddresses(): Promise<{
  updatedCount: number
  skippedCount: number
  failedCount: number
  results: Array<{ organizationName: string; status: string; message: string }>
}> {
  return requestJson("/organizations/research-addresses", { method: "POST" })
}

export async function getRefreshStatus(): Promise<RefreshResult | null> {
  const payload = await requestJson<{ latestRefresh: RefreshResult | null }>("/refresh/status")
  return payload.latestRefresh
}

export async function getSharedDataStatus(): Promise<SharedDataStatus> {
  return requestJson<SharedDataStatus>("/shared-data/status")
}

export async function getSharedAdvisorExportRows(): Promise<AdvisorExportRow[]> {
  const payload = await requestJson<{ rows: AdvisorExportRow[] }>("/shared-data/advisor-export")
  return payload.rows
}

export async function replaceSharedAdvisorExportRows(
  items: Array<{
    organizationId: string
    organizationName: string
    donationAmount: number | null
    notes: string
    includeInExport: boolean
    details: Record<string, string>
  }>,
): Promise<AdvisorExportRow[]> {
  const payload = await requestJson<{ rows: AdvisorExportRow[] }>("/shared-data/advisor-export", {
    method: "PUT",
    body: JSON.stringify({ items }),
  })
  return payload.rows
}

export async function updateSharedAdvisorExportRow(
  organizationId: string,
  input: {
    organizationName: string
    donationAmount: number | null
    notes: string
    includeInExport: boolean
    details: Record<string, string>
  },
): Promise<AdvisorExportRow> {
  const payload = await requestJson<{ row: AdvisorExportRow }>(`/shared-data/advisor-export/${organizationId}`, {
    method: "PATCH",
    body: JSON.stringify({
      organizationId,
      ...input,
    }),
  })
  return payload.row
}

export async function removeSharedAdvisorExportRow(organizationId: string): Promise<void> {
  await requestJson(`/shared-data/advisor-export/${organizationId}`, {
    method: "DELETE",
  })
}

export async function logAdvisorExportGenerated(summary: {
  selectedCount: number
  totalDonationAmount: number
  rowCount: number
}): Promise<void> {
  await requestJson("/shared-data/advisor-export/generated", {
    method: "POST",
    body: JSON.stringify(summary),
  })
}

export async function getClientActivity(limit = 100): Promise<ClientActivityEntry[]> {
  const payload = await requestJson<{ entries: Array<Record<string, unknown>> }>(
    `/shared-data/client-activity?limit=${limit}`,
  )
  return payload.entries.map((entry) => ({
    id: String(entry.id),
    actorType: String(entry.actor_type ?? "client"),
    actorName: String(entry.actor_name ?? "client"),
    actionType: entry.action_type as ClientActivityEntry["actionType"],
    organizationId: entry.organization_id ? String(entry.organization_id) : null,
    organizationName: entry.organization_name ? String(entry.organization_name) : null,
    oldValue: (entry.old_value_json as Record<string, unknown> | null) ?? null,
    newValue: (entry.new_value_json as Record<string, unknown> | null) ?? null,
    createdAt: String(entry.created_at),
  }))
}
