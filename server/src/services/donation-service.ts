import { randomUUID } from "node:crypto"
import type { DonationRecord, Organization, OrganizationAddress } from "../types/organization.js"
import { isSupabaseConfigured } from "../config/supabase-config.js"
import { getOrganizationById, readStoredOrganizations, saveOrganizations } from "./data-store-service.js"
import { rankOrganizations } from "./ranking-service.js"
import type { SharedDataActor } from "./supabase-shared-data-service.js"
import {
  attachSharedDonationsToOrganization,
  attachSharedDonationsToOrganizations,
  deleteDonationEntry,
  insertDonationEntry,
  listDonationEntriesForOrganization,
  mergeDonationsIntoOrganization,
  updateDonationEntry,
} from "./supabase-shared-data-service.js"

export interface DonationInput {
  date: string
  amount: number
  note?: string
}

export interface DonationYearSummary {
  year: string
  total: number
  count: number
  donations: DonationRecord[]
}

function getDonationYear(date: string): string {
  return date.slice(0, 4)
}

export function getDonationYearSummaries(donations: DonationRecord[]): DonationYearSummary[] {
  const grouped = new Map<string, DonationRecord[]>()

  for (const donation of donations) {
    const year = getDonationYear(donation.date)
    const existing = grouped.get(year) ?? []
    existing.push(donation)
    grouped.set(year, existing)
  }

  return [...grouped.entries()]
    .sort(([leftYear], [rightYear]) => Number(rightYear) - Number(leftYear))
    .map(([year, yearDonations]) => ({
      year,
      total: yearDonations.reduce((sum, donation) => sum + donation.amount, 0),
      count: yearDonations.length,
      donations: yearDonations.sort((left, right) => right.date.localeCompare(left.date)),
    }))
}

export function getCurrentYearDonationTotal(donations: DonationRecord[], year = new Date().getFullYear()): number {
  const yearPrefix = String(year)
  return donations
    .filter((donation) => donation.date.startsWith(yearPrefix))
    .reduce((sum, donation) => sum + donation.amount, 0)
}

export function syncDonationDerivedFields(organization: Organization): Organization {
  const donations = organization.donations ?? []
  return {
    ...organization,
    donations,
    approximateAnnualDonation: getCurrentYearDonationTotal(donations),
  }
}

function sortDonations(donations: DonationRecord[]): DonationRecord[] {
  return [...donations].sort((left, right) => right.date.localeCompare(left.date) || right.amount - left.amount)
}

async function saveOrganizationWithDonations(organizationId: string, updater: (organization: Organization) => Organization): Promise<Organization | null> {
  const organizations = await readStoredOrganizations()
  const organizationIndex = organizations.findIndex((organization) => organization.id === organizationId)
  if (organizationIndex < 0) return null

  const updatedOrganization = syncDonationDerivedFields(updater(organizations[organizationIndex]))
  organizations[organizationIndex] = updatedOrganization
  const rankedOrganizations = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(rankedOrganizations)

  return rankedOrganizations.find((organization) => organization.id === organizationId) ?? null
}

async function buildOrganizationWithSharedDonations(organizationId: string): Promise<Organization | null> {
  const organization = await getOrganizationById(organizationId)
  if (!organization) return null
  return attachSharedDonationsToOrganization(organization)
}

export async function addDonation(
  organizationId: string,
  input: DonationInput,
  actor?: SharedDataActor,
): Promise<Organization | null> {
  if (isSupabaseConfigured()) {
    const organization = await getOrganizationById(organizationId)
    if (!organization) return null

    await insertDonationEntry(
      {
        organizationId,
        organizationName: organization.organizationName,
        date: input.date,
        amount: input.amount,
        note: input.note?.trim() ?? "",
      },
      actor,
    )

    return buildOrganizationWithSharedDonations(organizationId)
  }

  const donation: DonationRecord = {
    id: randomUUID(),
    date: input.date,
    amount: input.amount,
    note: input.note?.trim() ?? "",
  }

  return saveOrganizationWithDonations(organizationId, (organization) => ({
    ...organization,
    donations: sortDonations([...(organization.donations ?? []), donation]),
  }))
}

export async function updateDonation(
  organizationId: string,
  donationId: string,
  input: Partial<DonationInput>,
  actor?: SharedDataActor,
): Promise<Organization | null> {
  if (isSupabaseConfigured()) {
    const updated = await updateDonationEntry(
      organizationId,
      donationId,
      {
        date: input.date,
        amount: input.amount,
        note: input.note !== undefined ? input.note.trim() : undefined,
      },
      actor,
    )
    if (!updated) return null
    return buildOrganizationWithSharedDonations(organizationId)
  }

  return saveOrganizationWithDonations(organizationId, (organization) => ({
    ...organization,
    donations: sortDonations(
      (organization.donations ?? []).map((donation) =>
        donation.id === donationId
          ? {
              ...donation,
              date: input.date ?? donation.date,
              amount: input.amount ?? donation.amount,
              note: input.note !== undefined ? input.note.trim() : donation.note,
            }
          : donation,
      ),
    ),
  }))
}

export async function deleteDonation(
  organizationId: string,
  donationId: string,
  actor?: SharedDataActor,
): Promise<Organization | null> {
  if (isSupabaseConfigured()) {
    const removed = await deleteDonationEntry(organizationId, donationId, actor)
    if (!removed) return null
    return buildOrganizationWithSharedDonations(organizationId)
  }

  return saveOrganizationWithDonations(organizationId, (organization) => ({
    ...organization,
    donations: (organization.donations ?? []).filter((donation) => donation.id !== donationId),
  }))
}

export async function updateOrganizationAddress(
  organizationId: string,
  address: OrganizationAddress,
): Promise<Organization | null> {
  const organization = await saveOrganizationWithDonations(organizationId, (entry) => ({
    ...entry,
    address: {
      street: address.street?.trim() ?? "",
      city: address.city?.trim() ?? "",
      state: address.state?.trim() ?? "",
      postalCode: address.postalCode?.trim() ?? "",
      country: address.country?.trim() || "US",
    },
  }))

  if (!organization) return null
  if (!isSupabaseConfigured()) return organization
  return attachSharedDonationsToOrganization(organization)
}

export async function getOrganizationDonationSummaries(organizationId: string): Promise<DonationYearSummary[] | null> {
  if (isSupabaseConfigured()) {
    const donations = await listDonationEntriesForOrganization(organizationId)
    return getDonationYearSummaries(donations)
  }

  const organization = await getOrganizationById(organizationId)
  if (!organization) return null
  return getDonationYearSummaries(organization.donations ?? [])
}

export { attachSharedDonationsToOrganizations, mergeDonationsIntoOrganization }
