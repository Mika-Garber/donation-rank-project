import type { Organization } from "../types/organization.js"
import type { AdvisorExportItemRow } from "../types/shared-data.js"

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

export interface AdvisorExportRow {
  organizationId: string
  included: boolean
  donationAmount: number
  ledgerDonationTotal: number
  hasManualAmountOverride: boolean
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

function getOrganizationAddress(organization: Organization | undefined) {
  return (
    organization?.address ?? {
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US",
    }
  )
}

export function buildAdvisorExportRowFromSharedItem(
  item: AdvisorExportItemRow,
  organization?: Organization,
): AdvisorExportRow {
  const address = getOrganizationAddress(organization)
  const details = item.details_json ?? {}
  const ledgerDonationTotal = organization?.approximateAnnualDonation ?? 0
  const hasManualAmountOverride = details.hasManualAmountOverride === true || details.hasManualAmountOverride === "true"
  const storedAmount = item.donation_amount !== null ? Number(item.donation_amount) : ledgerDonationTotal
  const donationAmount = hasManualAmountOverride ? storedAmount : ledgerDonationTotal

  return {
    organizationId: item.organization_id,
    included: item.include_in_export,
    donationAmount,
    ledgerDonationTotal,
    hasManualAmountOverride,
    organizationName: asTrimmedString(item.organization_name || organization?.organizationName),
    checkPayeeName:
      asTrimmedString(details.checkPayeeName) ||
      asTrimmedString(organization?.checkPayeeName) ||
      asTrimmedString(organization?.organizationName),
    addressLine1:
      asTrimmedString(details.addressLine1) ||
      asTrimmedString(organization?.donationMailingAddressLine1) ||
      asTrimmedString(address.street),
    addressLine2:
      asTrimmedString(details.addressLine2) || asTrimmedString(organization?.donationMailingAddressLine2),
    city: asTrimmedString(details.city) || asTrimmedString(organization?.donationMailingCity) || asTrimmedString(address.city),
    state: asTrimmedString(details.state) || asTrimmedString(organization?.donationMailingState) || asTrimmedString(address.state),
    zip: asTrimmedString(details.zip) || asTrimmedString(organization?.donationMailingZip) || asTrimmedString(address.postalCode),
    country:
      asTrimmedString(details.country) ||
      asTrimmedString(organization?.donationMailingCountry) ||
      asTrimmedString(address.country) ||
      "US",
    ein: asTrimmedString(organization?.ein),
    notes: asTrimmedString(item.notes || organization?.advisorExportNotes),
  }
}

export function advisorExportRowToSharedItemInput(row: AdvisorExportRow): {
  organizationId: string
  organizationName: string
  donationAmount: number | null
  notes: string
  includeInExport: boolean
  details: Record<string, string>
} {
  return {
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    donationAmount: row.donationAmount > 0 ? row.donationAmount : null,
    notes: row.notes,
    includeInExport: row.included,
    details: {
      checkPayeeName: row.checkPayeeName,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      state: row.state,
      zip: row.zip,
      country: row.country,
      hasManualAmountOverride: row.hasManualAmountOverride ? "true" : "false",
    },
  }
}
