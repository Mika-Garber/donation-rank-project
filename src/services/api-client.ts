import type {
  DonationYearSummary,
  GivingPlanGroup,
  LegacyPlanResponse,
  Organization,
  OrganizationAddress,
  ResearchAuditResponse,
  RankingExplanation,
  RefreshResult,
  TriageQueueItem,
  WatchdogSetupStatus,
} from "../types/organization"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api"
const APP_ACCESS_TOKEN = import.meta.env.VITE_APP_ACCESS_TOKEN ?? ""

async function requestJson<TResponse>(path: string, options?: RequestInit): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(APP_ACCESS_TOKEN ? { "x-access-token": APP_ACCESS_TOKEN } : {}),
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
  category: string
  subcategory: string
  approximateAnnualDonation: number
  website: string
  notes: string
}): Promise<Organization> {
  const payload = await requestJson<{ organization: Organization }>("/organizations", {
    method: "POST",
    body: JSON.stringify(input),
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
