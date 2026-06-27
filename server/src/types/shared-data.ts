export type ClientActivityActionType =
  | "donation_added"
  | "donation_edited"
  | "donation_deleted"
  | "advisor_item_added"
  | "advisor_item_edited"
  | "advisor_item_removed"
  | "advisor_export_generated"

export interface DonationEntryRow {
  id: string
  organization_id: string
  organization_name: string
  donation_amount: number
  donation_date: string
  donation_year: number
  note: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface AdvisorExportItemRow {
  id: string
  organization_id: string
  organization_name: string
  donation_amount: number | null
  notes: string
  include_in_export: boolean
  details_json: Record<string, unknown>
  sent_to_advisor_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ClientActivityLogRow {
  id: string
  actor_type: string
  actor_name: string
  action_type: ClientActivityActionType
  organization_id: string | null
  organization_name: string | null
  old_value_json: Record<string, unknown> | null
  new_value_json: Record<string, unknown> | null
  created_at: string
}

export interface AdvisorExportDetailsJson {
  checkPayeeName?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}
