import type { AdvisorExportInput, Organization } from "../types/organization.js"
import { readStoredOrganizations, saveOrganizations } from "./data-store-service.js"
import { syncDonationDerivedFields } from "./donation-service.js"
import { rankOrganizations } from "./ranking-service.js"

function trim(value: string | undefined): string {
  return value?.trim() ?? ""
}

function applyAdvisorExportInput(organization: Organization, input: AdvisorExportInput): Organization {
  return {
    ...organization,
    checkPayeeName: input.checkPayeeName !== undefined ? trim(input.checkPayeeName) : organization.checkPayeeName,
    donationMailingAddressLine1:
      input.donationMailingAddressLine1 !== undefined
        ? trim(input.donationMailingAddressLine1)
        : organization.donationMailingAddressLine1,
    donationMailingAddressLine2:
      input.donationMailingAddressLine2 !== undefined
        ? trim(input.donationMailingAddressLine2)
        : organization.donationMailingAddressLine2,
    donationMailingCity:
      input.donationMailingCity !== undefined ? trim(input.donationMailingCity) : organization.donationMailingCity,
    donationMailingState:
      input.donationMailingState !== undefined ? trim(input.donationMailingState) : organization.donationMailingState,
    donationMailingZip:
      input.donationMailingZip !== undefined ? trim(input.donationMailingZip) : organization.donationMailingZip,
    donationMailingCountry:
      input.donationMailingCountry !== undefined
        ? trim(input.donationMailingCountry) || "US"
        : organization.donationMailingCountry,
    advisorExportNotes:
      input.advisorExportNotes !== undefined ? trim(input.advisorExportNotes) : organization.advisorExportNotes,
  }
}

export async function updateOrganizationAdvisorExport(
  organizationId: string,
  input: AdvisorExportInput,
): Promise<Organization | null> {
  const organizations = await readStoredOrganizations()
  const organizationIndex = organizations.findIndex((organization) => organization.id === organizationId)
  if (organizationIndex < 0) return null

  organizations[organizationIndex] = applyAdvisorExportInput(organizations[organizationIndex], input)
  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(rankedOrganizations)
  return rankedOrganizations.find((organization) => organization.id === organizationId) ?? null
}

export interface AdvisorExportBatchItem {
  organizationId: string
  input: AdvisorExportInput
}

export async function updateOrganizationAdvisorExportBatch(
  items: AdvisorExportBatchItem[],
): Promise<{ savedCount: number }> {
  if (items.length === 0) return { savedCount: 0 }

  const organizations = await readStoredOrganizations()
  const updatesById = new Map(items.map((item) => [item.organizationId, item.input]))

  const updatedOrganizations = organizations.map((organization) => {
    const input = updatesById.get(organization.id)
    return input ? applyAdvisorExportInput(organization, input) : organization
  })

  const rankedOrganizations = rankOrganizations(updatedOrganizations.map(syncDonationDerivedFields))
  await saveOrganizations(rankedOrganizations)
  return { savedCount: items.length }
}
