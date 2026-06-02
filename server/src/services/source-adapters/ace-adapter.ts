import type { Organization, SourceMeta } from "../../types/organization.js"
import { findAceRecommendation, getAceCatalog } from "../watchdog-catalog-service.js"
import type { ResearchAdapter, ResearchPatch } from "./adapter-types.js"

function buildSourceMeta(confidenceNote: string): SourceMeta {
  return {
    sourceName: "Animal Charity Evaluators catalog",
    fetchedAt: new Date().toISOString(),
    confidenceNote,
    sourceType: "Animal Charity Evaluators",
    reliability: "medium",
  }
}

export const aceAdapter: ResearchAdapter = {
  sourceName: "Animal Charity Evaluators",
  async enrichOrganization(organization: Organization): Promise<ResearchPatch> {
    const match = findAceRecommendation(organization.organizationName, `${organization.ein ?? ""}`)
    if (!match) {
      return {
        organizationPatch: {},
        sourceMetaPatch: {},
        changedFields: [],
        errors: [],
      }
    }

    const organizationPatch: Partial<Organization> = {}
    const sourceMetaPatch: Record<string, SourceMeta> = {}
    const changedFields: string[] = []
    const catalog = getAceCatalog()

    if (!organization.aceRecommendation) {
      organizationPatch.aceRecommendation = match.recommendation
      sourceMetaPatch.aceRecommendation = buildSourceMeta(
        `Matched ACE ${match.recommendation} charity "${match.matchedName}" (catalog updated ${catalog.updatedAt}).`,
      )
      changedFields.push("aceRecommendation")
    }

    const impactNote = `ACE ${match.recommendation} charity: ${match.matchedName}.`
    if (!organization.impactEvidenceNotes.trim()) {
      organizationPatch.impactEvidenceNotes = impactNote
      sourceMetaPatch.impactEvidenceNotes = buildSourceMeta("Impact note seeded from ACE recommendation match.")
      changedFields.push("impactEvidenceNotes")
    }

    return {
      organizationPatch,
      sourceMetaPatch,
      changedFields,
      errors: [],
    }
  },
}
