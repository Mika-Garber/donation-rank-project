import type { DuplicateMissionRole, Organization } from "../types/organization.js"
import { readStoredOrganizations, saveOrganizations } from "./data-store-service.js"
import { syncDonationDerivedFields } from "./donation-service.js"
import { rankOrganizations } from "./ranking-service.js"

export interface MissionOverlapInput {
  duplicateMission?: string
  duplicateMissionGroup?: string
  duplicateMissionRole?: DuplicateMissionRole
}

function normalizeDuplicateMission(value: string | undefined): string {
  if (value === undefined) return ""
  const normalized = value.trim().toUpperCase()
  if (normalized === "Y" || normalized === "YES") return "Y"
  if (normalized === "N" || normalized === "NO") return "N"
  return ""
}

function normalizeDuplicateMissionRole(value: string | undefined): DuplicateMissionRole {
  if (!value) return ""
  if (value === "primary" || value === "secondary" || value === "phasing-out") return value
  return ""
}

export async function updateOrganizationMissionOverlap(
  organizationId: string,
  input: MissionOverlapInput,
): Promise<Organization | null> {
  const organizations = await readStoredOrganizations()
  const organizationIndex = organizations.findIndex((organization) => organization.id === organizationId)
  if (organizationIndex < 0) return null

  const currentOrganization = organizations[organizationIndex]
  organizations[organizationIndex] = {
    ...currentOrganization,
    ...(input.duplicateMission !== undefined
      ? { duplicateMission: normalizeDuplicateMission(input.duplicateMission) }
      : {}),
    ...(input.duplicateMissionGroup !== undefined
      ? { duplicateMissionGroup: input.duplicateMissionGroup.trim() }
      : {}),
    ...(input.duplicateMissionRole !== undefined
      ? { duplicateMissionRole: normalizeDuplicateMissionRole(input.duplicateMissionRole) }
      : {}),
  }

  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(rankedOrganizations)

  return rankedOrganizations.find((organization) => organization.id === organizationId) ?? null
}
