import type { Organization, SourceMeta } from "../../types/organization.js"

export interface ResearchPatch {
  organizationPatch: Partial<Organization>
  sourceMetaPatch: Record<string, SourceMeta>
  changedFields: string[]
  errors: string[]
}

export interface ResearchAdapter {
  sourceName: string
  enrichOrganization: (organization: Organization) => Promise<ResearchPatch>
}
