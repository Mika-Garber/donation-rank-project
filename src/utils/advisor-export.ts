import type { Organization } from "../types/organization"

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function getOrganizationAddress(organization: Organization) {
  return organization.address ?? {
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  }
}

export type AdvisorExportWarningType =
  | "Missing donation amount"
  | "Missing check payee name"
  | "Missing mailing address"

export interface AdvisorExportRow {
  organizationId: string
  included: boolean
  donationAmount: number
  organizationName: string
  checkPayeeName: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zip: string
  country: string
  ein: string
  notes: string
}

export interface AdvisorExportStats {
  selectedCount: number
  totalDonationAmount: number
  missingAddressCount: number
  missingDonationAmountCount: number
}

export interface AdvisorExportInputPayload {
  checkPayeeName: string
  donationMailingAddressLine1: string
  donationMailingAddressLine2: string
  donationMailingCity: string
  donationMailingState: string
  donationMailingZip: string
  donationMailingCountry: string
  advisorExportNotes: string
}

export function buildAdvisorExportRowFromOrganization(
  organization: Organization,
  included: boolean,
): AdvisorExportRow {
  const address = getOrganizationAddress(organization)

  return {
    organizationId: organization.id,
    included,
    donationAmount: organization.approximateAnnualDonation ?? 0,
    organizationName: asTrimmedString(organization.organizationName),
    checkPayeeName:
      asTrimmedString(organization.checkPayeeName) || asTrimmedString(organization.organizationName),
    addressLine1:
      asTrimmedString(organization.donationMailingAddressLine1) || asTrimmedString(address.street),
    addressLine2: asTrimmedString(organization.donationMailingAddressLine2),
    city: asTrimmedString(organization.donationMailingCity) || asTrimmedString(address.city),
    state: asTrimmedString(organization.donationMailingState) || asTrimmedString(address.state),
    zip: asTrimmedString(organization.donationMailingZip) || asTrimmedString(address.postalCode),
    country:
      asTrimmedString(organization.donationMailingCountry) || asTrimmedString(address.country) || "US",
    ein: asTrimmedString(organization.ein),
    notes: asTrimmedString(organization.advisorExportNotes),
  }
}

export function getAdvisorExportWarnings(row: AdvisorExportRow): AdvisorExportWarningType[] {
  const warnings: AdvisorExportWarningType[] = []
  if (row.donationAmount <= 0) warnings.push("Missing donation amount")
  if (!row.checkPayeeName.trim()) warnings.push("Missing check payee name")
  if (!row.addressLine1.trim() || !row.city.trim() || !row.state.trim() || !row.zip.trim()) {
    warnings.push("Missing mailing address")
  }
  return warnings
}

export function hasCompleteAdvisorExportRow(row: AdvisorExportRow): boolean {
  return getAdvisorExportWarnings(row).length === 0
}

export function buildAdvisorExportStats(
  rows: AdvisorExportRow[],
  onlyIncluded = true,
): AdvisorExportStats {
  const visibleRows = onlyIncluded ? rows.filter((row) => row.included) : rows
  return {
    selectedCount: visibleRows.length,
    totalDonationAmount: visibleRows.reduce((sum, row) => sum + (row.donationAmount > 0 ? row.donationAmount : 0), 0),
    missingAddressCount: visibleRows.filter((row) => getAdvisorExportWarnings(row).includes("Missing mailing address"))
      .length,
    missingDonationAmountCount: visibleRows.filter((row) =>
      getAdvisorExportWarnings(row).includes("Missing donation amount"),
    ).length,
  }
}

export function buildAdvisorExportInputFromRow(row: AdvisorExportRow): AdvisorExportInputPayload {
  return {
    checkPayeeName: row.checkPayeeName.trim(),
    donationMailingAddressLine1: row.addressLine1.trim(),
    donationMailingAddressLine2: row.addressLine2.trim(),
    donationMailingCity: row.city.trim(),
    donationMailingState: row.state.trim(),
    donationMailingZip: row.zip.trim(),
    donationMailingCountry: row.country.trim() || "US",
    advisorExportNotes: row.notes.trim(),
  }
}

function escapeCsvValue(value: string | number): string {
  const stringValue = String(value)
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export function buildAdvisorExportCsv(rows: AdvisorExportRow[], excludeIncomplete = false): string {
  const headers = [
    "Donation Amount",
    "Organization Name",
    "Check Payee Name",
    "Address Line 1",
    "Address Line 2",
    "City",
    "State",
    "ZIP",
    "EIN",
    "Notes",
  ]

  const exportRows = rows.filter((row) => {
    if (!row.included) return false
    if (excludeIncomplete && !hasCompleteAdvisorExportRow(row)) return false
    return true
  })

  const lines = [headers.join(",")]
  for (const row of exportRows) {
    lines.push(
      [
        row.donationAmount,
        row.organizationName,
        row.checkPayeeName,
        row.addressLine1,
        row.addressLine2,
        row.city,
        row.state,
        row.zip,
        row.ein,
        row.notes,
      ]
        .map(escapeCsvValue)
        .join(","),
    )
  }

  return lines.join("\n")
}

export function downloadAdvisorExportCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function formatAdvisorMailingAddress(row: AdvisorExportRow): string {
  const lines = [row.addressLine1.trim()]
  if (row.addressLine2.trim()) lines.push(row.addressLine2.trim())
  const cityLine = [row.city.trim(), row.state.trim(), row.zip.trim()].filter(Boolean).join(", ")
  if (cityLine) lines.push(cityLine)
  if (row.country.trim() && row.country.trim() !== "US") lines.push(row.country.trim())
  return lines.filter(Boolean).join("\n")
}

export function mergePersistedRowsWithOrganizations(
  currentRows: AdvisorExportRow[],
  organizations: Organization[],
): AdvisorExportRow[] {
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]))

  return currentRows
    .filter((row) => organizationById.has(row.organizationId))
    .map((row) => {
      const organization = organizationById.get(row.organizationId)!
      const defaults = buildAdvisorExportRowFromOrganization(organization, true)
      return {
        ...defaults,
        donationAmount: row.donationAmount,
        checkPayeeName: row.checkPayeeName,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        city: row.city,
        state: row.state,
        zip: row.zip,
        country: row.country,
        notes: row.notes,
      }
    })
    .sort((left, right) => left.organizationName.localeCompare(right.organizationName))
}
