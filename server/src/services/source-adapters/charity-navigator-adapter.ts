import type { Organization, SourceMeta } from "../../types/organization.js"
import { isCharityNavigatorConfigured } from "../../config/watchdog-config.js"
import { lookupCharityNavigatorOrganization } from "../charity-navigator-client.js"
import type { ResearchAdapter, ResearchPatch } from "./adapter-types.js"

function buildSourceMeta(confidenceNote: string): SourceMeta {
  return {
    sourceName: "Charity Navigator API",
    fetchedAt: new Date().toISOString(),
    confidenceNote,
    sourceType: "Charity Navigator",
    reliability: "high",
  }
}

export const charityNavigatorAdapter: ResearchAdapter = {
  sourceName: "Charity Navigator",
  async enrichOrganization(organization: Organization): Promise<ResearchPatch> {
    if (!isCharityNavigatorConfigured()) {
      return {
        organizationPatch: {},
        sourceMetaPatch: {
          charityNavigatorRating: buildSourceMeta("Charity Navigator API key is not configured."),
        },
        changedFields: [],
        errors: [],
      }
    }

    const ein = `${organization.ein ?? ""}`.trim()
    if (!ein) {
      return {
        organizationPatch: {},
        sourceMetaPatch: {},
        changedFields: [],
        errors: [],
      }
    }

    try {
      const result = await lookupCharityNavigatorOrganization(organization.organizationName, ein)
      if (!result) {
        return {
          organizationPatch: {},
          sourceMetaPatch: {
            charityNavigatorRating: buildSourceMeta("No Charity Navigator profile found for this EIN."),
          },
          changedFields: [],
          errors: [],
        }
      }

      const organizationPatch: Partial<Organization> = {}
      const sourceMetaPatch: Record<string, SourceMeta> = {}
      const changedFields: string[] = []

      if (organization.charityNavigatorRating === null && result.encompass_star_rating !== null) {
        organizationPatch.charityNavigatorRating = result.encompass_star_rating
        sourceMetaPatch.charityNavigatorRating = buildSourceMeta(
          `Star rating ${result.encompass_star_rating} from Charity Navigator API.`,
        )
        changedFields.push("charityNavigatorRating")
      }

      if (!organization.charityNavigatorProfileUrl?.trim() && result.charity_navigator_url) {
        organizationPatch.charityNavigatorProfileUrl = result.charity_navigator_url
        sourceMetaPatch.charityNavigatorProfileUrl = buildSourceMeta("Profile URL from Charity Navigator API.")
        changedFields.push("charityNavigatorProfileUrl")
      }

      if (!organization.charityNavigatorAlert?.trim() && result.highest_level_alert) {
        organizationPatch.charityNavigatorAlert = result.highest_level_alert
        sourceMetaPatch.charityNavigatorAlert = buildSourceMeta("Alert level from Charity Navigator API.")
        changedFields.push("charityNavigatorAlert")
      }

      if (!organization.website.trim() && result.organization_url) {
        organizationPatch.website = result.organization_url
        sourceMetaPatch.website = buildSourceMeta("Website URL from Charity Navigator API.")
        changedFields.push("website")
      }

      if (organization.charityNavigatorRating === null && result.encompass_star_rating === null) {
        sourceMetaPatch.charityNavigatorRating = buildSourceMeta("Charity Navigator profile found, but no star rating published.")
      }

      return {
        organizationPatch,
        sourceMetaPatch,
        changedFields,
        errors: [],
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Charity Navigator lookup failed."
      return {
        organizationPatch: {},
        sourceMetaPatch: {
          charityNavigatorRating: buildSourceMeta(message),
        },
        changedFields: [],
        errors: [message],
      }
    }
  },
}
