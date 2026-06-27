export type ClientActivityActionType =
  | "donation_added"
  | "donation_edited"
  | "donation_deleted"
  | "advisor_item_added"
  | "advisor_item_edited"
  | "advisor_item_removed"
  | "advisor_export_generated"

export interface ClientActivityEntry {
  id: string
  actorType: string
  actorName: string
  actionType: ClientActivityActionType
  organizationId: string | null
  organizationName: string | null
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  createdAt: string
}

export interface SharedDataStatus {
  sharedDataEnabled: boolean
  message: string
}
