import type { RefreshResult } from "../types/organization.js"
import { researchAllOrganizations } from "./research-service.js"

export async function refreshOrganizationsFromPublicSources(): Promise<RefreshResult> {
  return researchAllOrganizations()
}
