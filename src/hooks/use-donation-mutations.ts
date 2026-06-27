import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  addDonation,
  deleteDonation,
  updateDonation,
  updateOrganizationAddress,
  updateSharedAdvisorExportRow,
} from "../services/api-client"
import { useAdvisorExportStore } from "../store/use-advisor-export-store"
import type { DonationYearSummary, Organization, OrganizationAddress } from "../types/organization"
import {
  advisorExportRowToSharedItemInput,
  syncAdvisorExportRowsWithDonationTotals,
  type AdvisorExportRow,
} from "../utils/advisor-export"
import { advisorExportSharedQueryKey } from "./use-advisor-export-shared-query"
import { clientActivityQueryKey } from "./use-client-activity-query"
import { organizationQueryKey } from "./use-organization-query"
import { organizationsQueryKey } from "./use-organizations-query"
import { sharedDataStatusQueryKey } from "./use-shared-data-status-query"

export interface OrganizationDetailQueryData {
  organization: Organization
  donationSummaries: DonationYearSummary[]
}

function updateDonationCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  result: OrganizationDetailQueryData,
) {
  queryClient.setQueryData<OrganizationDetailQueryData>(organizationQueryKey(organizationId), result)

  queryClient.setQueryData<Organization[]>(organizationsQueryKey, (current) => {
    if (!current) return current
    return current.map((organization) =>
      organization.id === organizationId ? result.organization : organization,
    )
  })
}

function isSharedDataEnabled(queryClient: ReturnType<typeof useQueryClient>): boolean {
  return queryClient.getQueryData<{ sharedDataEnabled: boolean }>(sharedDataStatusQueryKey)?.sharedDataEnabled ?? false
}

function syncAdvisorExportAfterDonationChange(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  organizations: Organization[],
): void {
  const applySync = (rows: AdvisorExportRow[]) => syncAdvisorExportRowsWithDonationTotals(rows, organizations)

  useAdvisorExportStore.getState().setRows((rows) => applySync(rows))

  queryClient.setQueryData<AdvisorExportRow[]>(advisorExportSharedQueryKey, (current) => {
    if (!current) return current
    return applySync(current)
  })

  if (!isSharedDataEnabled(queryClient)) return

  const syncedRows = queryClient.getQueryData<AdvisorExportRow[]>(advisorExportSharedQueryKey)
  const syncedRow = syncedRows?.find((row) => row.organizationId === organizationId)
  if (!syncedRow || syncedRow.hasManualAmountOverride) return

  void updateSharedAdvisorExportRow(organizationId, advisorExportRowToSharedItemInput(syncedRow)).catch(() => undefined)
}

function invalidateDonationRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
) {
  void queryClient.invalidateQueries({ queryKey: organizationsQueryKey })
  void queryClient.invalidateQueries({ queryKey: organizationQueryKey(organizationId) })
  void queryClient.invalidateQueries({ queryKey: ["giving-plan"] })
  void queryClient.invalidateQueries({ queryKey: ["portfolio-concentration"] })
  void queryClient.invalidateQueries({ queryKey: ["portfolio-review"] })
  void queryClient.invalidateQueries({ queryKey: clientActivityQueryKey })
  void queryClient.invalidateQueries({ queryKey: advisorExportSharedQueryKey })
}

function handleDonationMutationSuccess(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  result: OrganizationDetailQueryData,
) {
  updateDonationCaches(queryClient, organizationId, result)

  const organizations =
    queryClient.getQueryData<Organization[]>(organizationsQueryKey) ?? [result.organization]
  syncAdvisorExportAfterDonationChange(queryClient, organizationId, organizations)

  invalidateDonationRelatedQueries(queryClient, organizationId)
}

export function useAddDonationMutation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { date: string; amount: number; note?: string }) => addDonation(organizationId, input),
    onSuccess: (result) => handleDonationMutationSuccess(queryClient, organizationId, result),
  })
}

export function useUpdateDonationMutation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { donationId: string; date?: string; amount?: number; note?: string }) =>
      updateDonation(organizationId, input.donationId, input),
    onSuccess: (result) => handleDonationMutationSuccess(queryClient, organizationId, result),
  })
}

export function useDeleteDonationMutation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (donationId: string) => deleteDonation(organizationId, donationId),
    onSuccess: (result) => handleDonationMutationSuccess(queryClient, organizationId, result),
  })
}

export function useUpdateOrganizationAddressMutation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (address: OrganizationAddress) => updateOrganizationAddress(organizationId, address),
    onSuccess: (organization) => {
      queryClient.setQueryData<OrganizationDetailQueryData | undefined>(
        organizationQueryKey(organizationId),
        (current) => (current ? { ...current, organization } : current),
      )
      queryClient.setQueryData<Organization[]>(organizationsQueryKey, (current) => {
        if (!current) return current
        return current.map((item) => (item.id === organizationId ? organization : item))
      })
      invalidateDonationRelatedQueries(queryClient, organizationId)
    },
  })
}
