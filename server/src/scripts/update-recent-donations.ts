import { randomUUID } from "node:crypto"
import { readStoredOrganizations, saveOrganizations } from "../services/data-store-service.js"
import { createOrganizationFromInput } from "../services/csv-seed-service.js"
import { syncDonationDerivedFields } from "../services/donation-service.js"
import { rankOrganizations } from "../services/ranking-service.js"
import type { DonationRecord, Organization, OrganizationAddress } from "../types/organization.js"

function getTodayDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

interface DonationUpdate {
  organizationName: string
  amount: number
  address?: OrganizationAddress
  note: string
  createIfMissing?: {
    ein: string
    website: string
    category: string
    subcategory: string
  }
}

const UPDATES: DonationUpdate[] = [
  {
    organizationName: "Pawtcake Refuge",
    amount: 750,
    address: {
      street: "PO Box 54",
      city: "Old Bethpage",
      state: "NY",
      postalCode: "11804",
      country: "US",
    },
    note: "Recent gift logged from client records (PO Box 54, Old Bethpage, NY 11804).",
  },
  {
    organizationName: "Outcast Rescue",
    amount: 500,
    address: {
      street: "PO Box 12",
      city: "Catasauqua",
      state: "PA",
      postalCode: "18032",
      country: "US",
    },
    note: "Recent gift logged from client records (PO Box 12, Catasauqua, PA 18032).",
    createIfMissing: {
      ein: "81-2867688",
      website: "",
      category: "Animal",
      subcategory: "Dogs",
    },
  },
  {
    organizationName: "HHART (Halfway Home Animal Rescue Team)",
    amount: 1000,
    address: {
      street: "PO Box 312",
      city: "Oakland",
      state: "NJ",
      postalCode: "07436",
      country: "US",
    },
    note: "Recent gift logged from client records (PO Box 312, Oakland, NJ 07436).",
    createIfMissing: {
      ein: "83-4402588",
      website: "",
      category: "Animal",
      subcategory: "",
    },
  },
  {
    organizationName: "PETA",
    amount: 1000,
    address: {
      street: "PO Box 96684",
      city: "Washington",
      state: "DC",
      postalCode: "20090-6684",
      country: "US",
    },
    note: "Recent gift logged from client records (PO Box 96684, Washington, DC 20090-6684).",
  },
  {
    organizationName: "Hounds in Pounds",
    amount: 1000,
    address: {
      street: "189 Berdan Ave, #138",
      city: "Wayne",
      state: "NJ",
      postalCode: "07470",
      country: "US",
    },
    note: "Recent gift logged from client records (189 Berdan Ave, #138, Wayne, NJ 07470).",
  },
  {
    organizationName: "White Coat Waste Project",
    amount: 500,
    address: {
      street: "PO Box 26029",
      city: "Washington",
      state: "DC",
      postalCode: "20001",
      country: "US",
    },
    note: "Recent gift logged from client records (PO Box 26029, Washington, DC 20001).",
  },
  {
    organizationName: "Rescue Dogs Rock",
    amount: 750,
    address: {
      street: "PO Box 101, Gracie Station",
      city: "New York",
      state: "NY",
      postalCode: "10028",
      country: "US",
    },
    note: "Recent gift logged from client records (PO Box 101, Gracie Station, New York, NY 10028).",
  },
]

const ESTIMATE_NOTE = "Imported from annual estimate — replace with actual gifts as you log them."

/** Prior Jan 1 annual-estimate gifts that must be preserved alongside new gifts. */
const ORIGINAL_ESTIMATE_DONATIONS: Record<string, { id: string; amount: number }> = {
  "Pawtcake Refuge": { id: "3fbd639f-de04-4c20-9d6c-63a02ceab235", amount: 400 },
  PETA: { id: "e42a81da-348f-4cf7-b9c2-5c74b49d6b87", amount: 500 },
  "Hounds in Pounds": { id: "315a5f0b-4069-4e52-90da-39c39a8996f9", amount: 150 },
  "White Coat Waste Project": { id: "1b2f2aca-fe4e-489a-a567-0baef029d9cc", amount: 500 },
  "Rescue Dogs Rock": { id: "bc36409f-5a5c-455d-b854-a51b7c89e917", amount: 300 },
}

function ensureAnnualEstimate(donations: DonationRecord[], organizationName: string): DonationRecord[] {
  const estimate = ORIGINAL_ESTIMATE_DONATIONS[organizationName]
  if (!estimate) return donations

  const hasEstimate = donations.some((donation) =>
    donation.note.toLowerCase().includes("imported from annual estimate"),
  )
  if (hasEstimate) return donations

  return [
    ...donations,
    {
      id: estimate.id,
      date: "2026-01-01",
      amount: estimate.amount,
      note: ESTIMATE_NOTE,
    },
  ]
}

function addRecentGiftIfMissing(
  donations: DonationRecord[],
  amount: number,
  note: string,
  donationDate: string,
): DonationRecord[] {
  const hasRecentGift = donations.some((donation) =>
    donation.note.toLowerCase().includes("recent gift logged from client records"),
  )
  if (hasRecentGift) return donations

  return [
    ...donations,
    {
      id: randomUUID(),
      date: donationDate,
      amount,
      note,
    },
  ]
}

function applyDonationUpdate(
  organization: Organization,
  update: DonationUpdate,
  donationDate: string,
): Organization {
  const donations = addRecentGiftIfMissing(
    ensureAnnualEstimate(organization.donations ?? [], organization.organizationName),
    update.amount,
    update.note,
    donationDate,
  )
  return syncDonationDerivedFields({
    ...organization,
    ...(update.address ? { address: update.address } : {}),
    donations,
  })
}

async function main(): Promise<void> {
  const donationDate = getTodayDate()
  const organizations = await readStoredOrganizations()

  for (const update of UPDATES) {
    let index = organizations.findIndex(
      (organization) => organization.organizationName.toLowerCase() === update.organizationName.toLowerCase(),
    )

    if (index < 0 && update.organizationName.startsWith("HHART")) {
      index = organizations.findIndex((organization) =>
        organization.organizationName.toLowerCase().includes("halfway home animal rescue"),
      )
    }

    if (index < 0 && update.createIfMissing) {
      organizations.push(
        createOrganizationFromInput({
          organizationName: update.organizationName,
          category: update.createIfMissing.category,
          subcategory: update.createIfMissing.subcategory,
          ein: update.createIfMissing.ein,
          website: update.createIfMissing.website,
          is501c3Verified: "Y",
          address: update.address,
          donations: [],
        }),
      )
      index = organizations.length - 1
    }

    if (index < 0) {
      console.log(`Not found: ${update.organizationName}`)
      continue
    }

    organizations[index] = applyDonationUpdate(organizations[index], update, donationDate)
    const gifts = organizations[index].donations
    console.log(
      `Updated ${organizations[index].organizationName}: ${gifts.length} gift(s), 2026 total $${organizations[index].approximateAnnualDonation}`,
    )
  }

  const ranked = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(ranked)

  const total2026 = ranked.reduce((sum, organization) => sum + organization.approximateAnnualDonation, 0)
  console.log(`\nTotal 2026 logged giving across portfolio: $${total2026.toLocaleString()}`)
  console.log(`Organizations: ${ranked.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
