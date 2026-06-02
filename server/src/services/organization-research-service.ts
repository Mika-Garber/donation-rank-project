import type { Organization } from "../types/organization.js"
import { readStoredOrganizations, saveOrganizations } from "./data-store-service.js"
import { syncDonationDerivedFields } from "./donation-service.js"
import { rankOrganizations } from "./ranking-service.js"

export interface OrganizationResearchNotesInput {
  impactEvidenceNotes?: string
  accountabilityNotes?: string
  politicalInvolvementNotes?: string
}

async function saveOrganizationWithResearchNotes(
  organizationId: string,
  updater: (organization: Organization) => Organization,
): Promise<Organization | null> {
  const organizations = await readStoredOrganizations()
  const organizationIndex = organizations.findIndex((organization) => organization.id === organizationId)
  if (organizationIndex < 0) return null

  organizations[organizationIndex] = updater(organizations[organizationIndex])
  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(rankedOrganizations)

  return rankedOrganizations.find((organization) => organization.id === organizationId) ?? null
}

export async function updateOrganizationResearchNotes(
  organizationId: string,
  input: OrganizationResearchNotesInput,
): Promise<Organization | null> {
  return saveOrganizationWithResearchNotes(organizationId, (organization) => ({
    ...organization,
    ...(input.impactEvidenceNotes !== undefined
      ? { impactEvidenceNotes: input.impactEvidenceNotes.trim() }
      : {}),
    ...(input.accountabilityNotes !== undefined
      ? { accountabilityNotes: input.accountabilityNotes.trim() }
      : {}),
    ...(input.politicalInvolvementNotes !== undefined
      ? { politicalInvolvementNotes: input.politicalInvolvementNotes.trim() }
      : {}),
  }))
}
