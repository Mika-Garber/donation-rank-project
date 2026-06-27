import { randomUUID } from "node:crypto"
import type { DonationRecord, Organization } from "../types/organization.js"
import type {
  AdvisorExportDetailsJson,
  AdvisorExportItemRow,
  ClientActivityActionType,
  ClientActivityLogRow,
  DonationEntryRow,
} from "../types/shared-data.js"
import { getSupabaseAdminClient } from "./supabase-client.js"
import { isSupabaseConfigured } from "../config/supabase-config.js"

export interface SharedDataActor {
  actorType: string
  actorName: string
}

const defaultActor: SharedDataActor = {
  actorType: "client",
  actorName: "client",
}

function toDonationRecord(row: DonationEntryRow): DonationRecord {
  return {
    id: row.id,
    date: row.donation_date,
    amount: Number(row.donation_amount),
    note: row.note ?? "",
  }
}

function sortDonations(donations: DonationRecord[]): DonationRecord[] {
  return [...donations].sort((left, right) => right.date.localeCompare(left.date) || right.amount - left.amount)
}

export async function listDonationEntriesForOrganization(organizationId: string): Promise<DonationRecord[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("donation_entries")
    .select("*")
    .eq("organization_id", organizationId)
    .order("donation_date", { ascending: false })

  if (error) throw error
  return sortDonations((data ?? []).map((row) => toDonationRecord(row as DonationEntryRow)))
}

export async function listAllDonationEntriesGrouped(): Promise<Map<string, DonationRecord[]>> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("donation_entries")
    .select("*")
    .order("donation_date", { ascending: false })

  if (error) throw error

  const grouped = new Map<string, DonationRecord[]>()
  for (const row of data ?? []) {
    const donation = toDonationRecord(row as DonationEntryRow)
    const existing = grouped.get(row.organization_id) ?? []
    existing.push(donation)
    grouped.set(row.organization_id, existing)
  }

  for (const [organizationId, donations] of grouped.entries()) {
    grouped.set(organizationId, sortDonations(donations))
  }

  return grouped
}

export async function insertDonationEntry(
  input: {
    organizationId: string
    organizationName: string
    date: string
    amount: number
    note: string
  },
  actor: SharedDataActor = defaultActor,
): Promise<DonationRecord> {
  const supabase = getSupabaseAdminClient()
  const id = randomUUID()
  const { data, error } = await supabase
    .from("donation_entries")
    .insert({
      id,
      organization_id: input.organizationId,
      organization_name: input.organizationName,
      donation_amount: input.amount,
      donation_date: input.date,
      note: input.note,
      created_by: actor.actorName,
    })
    .select("*")
    .single()

  if (error) throw error

  const donation = toDonationRecord(data as DonationEntryRow)
  await logClientActivity({
    actor,
    actionType: "donation_added",
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    newValue: {
      id: donation.id,
      date: donation.date,
      amount: donation.amount,
      note: donation.note,
    },
  })

  return donation
}

export async function updateDonationEntry(
  organizationId: string,
  donationId: string,
  input: { date?: string; amount?: number; note?: string },
  actor: SharedDataActor = defaultActor,
): Promise<DonationRecord | null> {
  const supabase = getSupabaseAdminClient()
  const { data: existingRow, error: existingError } = await supabase
    .from("donation_entries")
    .select("*")
    .eq("id", donationId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (existingError) throw existingError
  if (!existingRow) return null

  const oldDonation = toDonationRecord(existingRow as DonationEntryRow)
  const patch: Record<string, unknown> = {}
  if (input.date !== undefined) patch.donation_date = input.date
  if (input.amount !== undefined) patch.donation_amount = input.amount
  if (input.note !== undefined) patch.note = input.note

  const { data, error } = await supabase
    .from("donation_entries")
    .update(patch)
    .eq("id", donationId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error) throw error

  const donation = toDonationRecord(data as DonationEntryRow)
  await logClientActivity({
    actor,
    actionType: "donation_edited",
    organizationId,
    organizationName: existingRow.organization_name,
    oldValue: {
      id: oldDonation.id,
      date: oldDonation.date,
      amount: oldDonation.amount,
      note: oldDonation.note,
    },
    newValue: {
      id: donation.id,
      date: donation.date,
      amount: donation.amount,
      note: donation.note,
    },
  })

  return donation
}

export async function deleteDonationEntry(
  organizationId: string,
  donationId: string,
  actor: SharedDataActor = defaultActor,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient()
  const { data: existingRow, error: existingError } = await supabase
    .from("donation_entries")
    .select("*")
    .eq("id", donationId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (existingError) throw existingError
  if (!existingRow) return false

  const oldDonation = toDonationRecord(existingRow as DonationEntryRow)
  const { error } = await supabase.from("donation_entries").delete().eq("id", donationId).eq("organization_id", organizationId)
  if (error) throw error

  await logClientActivity({
    actor,
    actionType: "donation_deleted",
    organizationId,
    organizationName: existingRow.organization_name,
    oldValue: {
      id: oldDonation.id,
      date: oldDonation.date,
      amount: oldDonation.amount,
      note: oldDonation.note,
    },
  })

  return true
}

export async function listAdvisorExportItemRows(): Promise<AdvisorExportItemRow[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("advisor_export_items")
    .select("*")
    .order("organization_name", { ascending: true })

  if (error) throw error
  return (data ?? []) as AdvisorExportItemRow[]
}

export async function upsertAdvisorExportItem(
  input: {
    organizationId: string
    organizationName: string
    donationAmount: number | null
    notes: string
    includeInExport: boolean
    details: AdvisorExportDetailsJson
    sentToAdvisorAt?: string | null
  },
  actor: SharedDataActor = defaultActor,
  isNew = false,
): Promise<AdvisorExportItemRow> {
  const supabase = getSupabaseAdminClient()
  const { data: existing, error: existingError } = await supabase
    .from("advisor_export_items")
    .select("*")
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  if (existingError) throw existingError

  const payload = {
    organization_id: input.organizationId,
    organization_name: input.organizationName,
    donation_amount: input.donationAmount,
    notes: input.notes,
    include_in_export: input.includeInExport,
    details_json: input.details,
    sent_to_advisor_at: input.sentToAdvisorAt ?? existing?.sent_to_advisor_at ?? null,
    created_by: existing?.created_by ?? actor.actorName,
  }

  const { data, error } = await supabase
    .from("advisor_export_items")
    .upsert(payload, { onConflict: "organization_id" })
    .select("*")
    .single()

  if (error) throw error

  const row = data as AdvisorExportItemRow
  await logClientActivity({
    actor,
    actionType: isNew ? "advisor_item_added" : "advisor_item_edited",
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    oldValue: existing
      ? {
          donationAmount: existing.donation_amount,
          notes: existing.notes,
          includeInExport: existing.include_in_export,
          details: existing.details_json,
        }
      : null,
    newValue: {
      donationAmount: row.donation_amount,
      notes: row.notes,
      includeInExport: row.include_in_export,
      details: row.details_json,
    },
  })

  return row
}

export async function deleteAdvisorExportItem(
  organizationId: string,
  actor: SharedDataActor = defaultActor,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient()
  const { data: existing, error: existingError } = await supabase
    .from("advisor_export_items")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (existingError) throw existingError
  if (!existing) return false

  const { error } = await supabase.from("advisor_export_items").delete().eq("organization_id", organizationId)
  if (error) throw error

  await logClientActivity({
    actor,
    actionType: "advisor_item_removed",
    organizationId,
    organizationName: existing.organization_name,
    oldValue: {
      donationAmount: existing.donation_amount,
      notes: existing.notes,
      includeInExport: existing.include_in_export,
      details: existing.details_json,
    },
  })

  return true
}

export async function replaceAdvisorExportItems(
  items: Array<{
    organizationId: string
    organizationName: string
    donationAmount: number | null
    notes: string
    includeInExport: boolean
    details: AdvisorExportDetailsJson
  }>,
  actor: SharedDataActor = defaultActor,
): Promise<AdvisorExportItemRow[]> {
  const supabase = getSupabaseAdminClient()
  const existing = await listAdvisorExportItemRows()
  const existingIds = new Set(existing.map((row) => row.organization_id))
  const nextIds = new Set(items.map((item) => item.organizationId))

  for (const row of existing) {
    if (!nextIds.has(row.organization_id)) {
      await deleteAdvisorExportItem(row.organization_id, actor)
    }
  }

  const results: AdvisorExportItemRow[] = []
  for (const item of items) {
    const row = await upsertAdvisorExportItem(item, actor, !existingIds.has(item.organizationId))
    results.push(row)
  }

  return results
}

export async function logAdvisorExportGenerated(
  summary: Record<string, unknown>,
  actor: SharedDataActor = defaultActor,
): Promise<void> {
  await logClientActivity({
    actor,
    actionType: "advisor_export_generated",
    organizationId: null,
    organizationName: null,
    newValue: summary,
  })
}

async function logClientActivity(input: {
  actor: SharedDataActor
  actionType: ClientActivityActionType
  organizationId: string | null
  organizationName: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
}): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from("client_activity_log").insert({
    id: randomUUID(),
    actor_type: input.actor.actorType,
    actor_name: input.actor.actorName,
    action_type: input.actionType,
    organization_id: input.organizationId,
    organization_name: input.organizationName,
    old_value_json: input.oldValue ?? null,
    new_value_json: input.newValue ?? null,
  })

  if (error) throw error
}

export async function listClientActivity(limit = 100): Promise<ClientActivityLogRow[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("client_activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as ClientActivityLogRow[]
}

export function mergeDonationsIntoOrganization(organization: Organization, donations: DonationRecord[]): Organization {
  const currentYear = new Date().getFullYear()
  const yearPrefix = String(currentYear)
  const approximateAnnualDonation = donations
    .filter((donation) => donation.date.startsWith(yearPrefix))
    .reduce((sum, donation) => sum + donation.amount, 0)

  return {
    ...organization,
    donations,
    approximateAnnualDonation,
  }
}

export function resolveDonationsForOrganization(
  organization: Organization,
  supabaseDonations: DonationRecord[],
): DonationRecord[] {
  const jsonDonations = organization.donations ?? []
  if (supabaseDonations.length > 0) return supabaseDonations
  return jsonDonations
}

export async function listAllDonationEntryIds(): Promise<Set<string>> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.from("donation_entries").select("id")

  if (error) throw error
  return new Set((data ?? []).map((row) => String(row.id)))
}

export async function importDonationEntriesWithoutActivity(
  entries: Array<{
    id: string
    organizationId: string
    organizationName: string
    date: string
    amount: number
    note: string
  }>,
): Promise<number> {
  if (entries.length === 0) return 0

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from("donation_entries").insert(
    entries.map((entry) => ({
      id: entry.id,
      organization_id: entry.organizationId,
      organization_name: entry.organizationName,
      donation_amount: entry.amount,
      donation_date: entry.date,
      note: entry.note,
      created_by: "system_import",
    })),
  )

  if (error) throw error
  return entries.length
}

export async function attachSharedDonationsToOrganizations(organizations: Organization[]): Promise<Organization[]> {
  if (!isSupabaseConfigured()) return organizations

  const grouped = await listAllDonationEntriesGrouped()
  return organizations.map((organization) =>
    mergeDonationsIntoOrganization(
      organization,
      resolveDonationsForOrganization(organization, grouped.get(organization.id) ?? []),
    ),
  )
}

export async function attachSharedDonationsToOrganization(organization: Organization): Promise<Organization> {
  if (!isSupabaseConfigured()) return organization
  const supabaseDonations = await listDonationEntriesForOrganization(organization.id)
  return mergeDonationsIntoOrganization(
    organization,
    resolveDonationsForOrganization(organization, supabaseDonations),
  )
}

export { isSupabaseConfigured }
