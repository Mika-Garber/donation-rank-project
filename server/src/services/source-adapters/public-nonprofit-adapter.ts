import type { Organization, SourceMeta } from "../../types/organization.js"
import {
  fetchProPublicaOrganizationByEin,
  proPublicaRecordToAddress,
  searchProPublicaOrganization,
} from "../propublica-client.js"
import type { ResearchAdapter, ResearchPatch } from "./adapter-types.js"

function buildSourceMeta(confidenceNote: string): SourceMeta {
  return {
    sourceName: "ProPublica Nonprofit Explorer",
    fetchedAt: new Date().toISOString(),
    confidenceNote,
    sourceType: "ProPublica/Form 990",
    reliability: "high",
  }
}

function isCompleteAddress(address: Organization["address"] | undefined): boolean {
  if (!address) return false
  return Boolean(address.street.trim() && address.city.trim() && address.state.trim() && address.postalCode.trim())
}

export const proPublicaAdapter: ResearchAdapter = {
  sourceName: "ProPublica Nonprofit Explorer",
  async enrichOrganization(organization: Organization): Promise<ResearchPatch> {
    let resolvedRecord = organization.ein ? await fetchProPublicaOrganizationByEin(organization.ein) : null
    if (!resolvedRecord) {
      resolvedRecord = await searchProPublicaOrganization(organization.organizationName)
    }

    if (!resolvedRecord) {
      return {
        organizationPatch: {},
        sourceMetaPatch: {
          ein: buildSourceMeta("No confirmed public record match found."),
        },
        changedFields: [],
        errors: [],
      }
    }

    const organizationPatch: Partial<Organization> = {}
    const sourceMetaPatch: Record<string, SourceMeta> = {}
    const changedFields: string[] = []

    if (!organization.ein && resolvedRecord.ein) {
      organizationPatch.ein = String(resolvedRecord.ein)
      sourceMetaPatch.ein = buildSourceMeta("Matched by organization name in public dataset.")
      changedFields.push("ein")
    }

    if (!organization.is501c3Verified && resolvedRecord.subsection_code === 3) {
      organizationPatch.is501c3Verified = "Y"
      sourceMetaPatch.is501c3Verified = buildSourceMeta("Subsection code indicates 501(c)(3).")
      changedFields.push("is501c3Verified")
    }

    if (!organization.notes && (resolvedRecord.city || resolvedRecord.state)) {
      organizationPatch.notes = `Public source location match: ${resolvedRecord.city}, ${resolvedRecord.state}`
      sourceMetaPatch.notes = buildSourceMeta("Added location context from public source.")
      changedFields.push("notes")
    }

    if (resolvedRecord.address?.trim()) {
      const nextAddress = proPublicaRecordToAddress(resolvedRecord)
      const shouldUpdateAddress = !isCompleteAddress(organization.address) || organization.address.street.trim() !== nextAddress.street.trim()
      if (shouldUpdateAddress && isCompleteAddress(nextAddress)) {
        organizationPatch.address = nextAddress
        sourceMetaPatch.address = buildSourceMeta(`IRS filing address for ${resolvedRecord.name}.`)
        changedFields.push("address")
      }
    }

    return {
      organizationPatch,
      sourceMetaPatch,
      changedFields,
      errors: [],
    }
  },
}
