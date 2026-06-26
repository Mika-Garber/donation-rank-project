import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  addDonation,
  deleteDonation,
  updateDonation,
  updateOrganizationAddress,
} from "../services/api-client"
import { useAdvisorExportStore } from "../store/use-advisor-export-store"
import type { DonationYearSummary, Organization, OrganizationAddress } from "../types/organization"
import { organizationQueryKey } from "./use-organization-query"
import { organizationsQueryKey } from "./use-organizations-query"

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

function syncAdvisorExportDonationAmount(organizationId: string, approximateAnnualDonation: number) {
  useAdvisorExportStore.getState().setRows((rows) => {
    if (!rows.some((row) => row.organizationId === organizationId)) return rows
    return rows.map((row) =>
      row.organizationId === organizationId ? { ...row, donationAmount: approximateAnnualDonation } : row,
    )
  })
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
}

function handleDonationMutationSuccess(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  result: OrganizationDetailQueryData,
) {
  updateDonationCaches(queryClient, organizationId, result)
  syncAdvisorExportDonationAmount(organizationId, result.organization.approximateAnnualDonation)
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
