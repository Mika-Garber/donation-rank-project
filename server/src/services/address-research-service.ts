import type { Organization, OrganizationAddress, SourceMeta } from "../types/organization.js"
import { readStoredOrganizations, saveOrganizations } from "./data-store-service.js"
import {
  fetchProPublicaOrganizationByEin,
  normalizeEin,
  proPublicaRecordToAddress,
  searchProPublicaOrganization,
} from "./propublica-client.js"
import { rankOrganizations } from "./ranking-service.js"

export interface AddressResearchResult {
  organizationName: string
  status: "updated" | "skipped" | "failed"
  address: OrganizationAddress | null
  message: string
}

function buildAddressSourceMeta(confidenceNote: string): SourceMeta {
  return {
    sourceName: "ProPublica Nonprofit Explorer (IRS Form 990)",
    fetchedAt: new Date().toISOString(),
    confidenceNote,
    sourceType: "ProPublica/Form 990",
    reliability: "high",
  }
}

function isCompleteAddress(address: OrganizationAddress | undefined): boolean {
  if (!address) return false
  return Boolean(address.street.trim() && address.city.trim() && address.state.trim() && address.postalCode.trim())
}

function addressesEqual(left: OrganizationAddress, right: OrganizationAddress): boolean {
  return (
    left.street.trim().toLowerCase() === right.street.trim().toLowerCase() &&
    left.city.trim().toLowerCase() === right.city.trim().toLowerCase() &&
    left.state.trim().toUpperCase() === right.state.trim().toUpperCase() &&
    left.postalCode.trim() === right.postalCode.trim()
  )
}

async function resolveProPublicaRecord(organization: Organization) {
  const normalizedEin = normalizeEin(organization.ein)
  if (normalizedEin) {
    const byEin = await fetchProPublicaOrganizationByEin(normalizedEin)
    if (byEin?.address) return byEin
  }

  return searchProPublicaOrganization(organization.organizationName)
}

export async function researchOrganizationAddress(organization: Organization): Promise<{
  organization: Organization
  result: AddressResearchResult
}> {
  const record = await resolveProPublicaRecord(organization)
  if (!record?.address?.trim()) {
    return {
      organization,
      result: {
        organizationName: organization.organizationName,
        status: isCompleteAddress(organization.address) ? "skipped" : "failed",
        address: organization.address ?? null,
        message: isCompleteAddress(organization.address)
          ? "Existing address kept; ProPublica returned no street address."
          : "Could not resolve a street address from ProPublica.",
      },
    }
  }

  const nextAddress = proPublicaRecordToAddress(record)
  if (!isCompleteAddress(nextAddress)) {
    return {
      organization,
      result: {
        organizationName: organization.organizationName,
        status: "failed",
        address: organization.address ?? null,
        message: "ProPublica record missing required address fields.",
      },
    }
  }

  if (isCompleteAddress(organization.address) && addressesEqual(organization.address, nextAddress)) {
    return {
      organization,
      result: {
        organizationName: organization.organizationName,
        status: "skipped",
        address: organization.address,
        message: "Address already matches ProPublica IRS filing address.",
      },
    }
  }

  const updatedOrganization: Organization = {
    ...organization,
    address: nextAddress,
    ein: organization.ein || String(record.ein),
    sourceMeta: {
      ...organization.sourceMeta,
      address: buildAddressSourceMeta(`IRS filing address for ${record.name}.`),
    },
  }

  return {
    organization: updatedOrganization,
    result: {
      organizationName: organization.organizationName,
      status: "updated",
      address: nextAddress,
      message: `Updated from ProPublica IRS address for ${record.name}.`,
    },
  }
}

export async function researchAllOrganizationAddresses(): Promise<{
  updatedCount: number
  skippedCount: number
  failedCount: number
  results: AddressResearchResult[]
}> {
  const organizations = await readStoredOrganizations()
  const results: AddressResearchResult[] = []
  const updatedOrganizations: Organization[] = []

  for (const organization of organizations) {
    const { organization: nextOrganization, result } = await researchOrganizationAddress(organization)
    results.push(result)
    updatedOrganizations.push(nextOrganization)
    await new Promise((resolve) => setTimeout(resolve, 120))
  }

  const rankedOrganizations = rankOrganizations(updatedOrganizations)
  await saveOrganizations(rankedOrganizations)

  return {
    updatedCount: results.filter((result) => result.status === "updated").length,
    skippedCount: results.filter((result) => result.status === "skipped").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    results,
  }
}
