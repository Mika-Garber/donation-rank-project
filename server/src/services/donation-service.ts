import { randomUUID } from "node:crypto"
import type { DonationRecord, Organization, OrganizationAddress } from "../types/organization.js"
import { getOrganizationById, readStoredOrganizations, saveOrganizations } from "./data-store-service.js"
import { rankOrganizations } from "./ranking-service.js"

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

export async function addDonation(organizationId: string, input: DonationInput): Promise<Organization | null> {
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
): Promise<Organization | null> {
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

export async function deleteDonation(organizationId: string, donationId: string): Promise<Organization | null> {
  return saveOrganizationWithDonations(organizationId, (organization) => ({
    ...organization,
    donations: (organization.donations ?? []).filter((donation) => donation.id !== donationId),
  }))
}

export async function updateOrganizationAddress(
  organizationId: string,
  address: OrganizationAddress,
): Promise<Organization | null> {
  return saveOrganizationWithDonations(organizationId, (organization) => ({
    ...organization,
    address: {
      street: address.street?.trim() ?? "",
      city: address.city?.trim() ?? "",
      state: address.state?.trim() ?? "",
      postalCode: address.postalCode?.trim() ?? "",
      country: address.country?.trim() || "US",
    },
  }))
}

export async function getOrganizationDonationSummaries(organizationId: string): Promise<DonationYearSummary[] | null> {
  const organization = await getOrganizationById(organizationId)
  if (!organization) return null
  return getDonationYearSummaries(organization.donations ?? [])
}
