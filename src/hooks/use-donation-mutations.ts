import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  addDonation,
  deleteDonation,
  updateDonation,
  updateOrganizationAddress,
} from "../services/api-client"
import type { OrganizationAddress } from "../types/organization"
import { organizationsQueryKey } from "./use-organizations-query"

function invalidateOrganizationQueries(queryClient: ReturnType<typeof useQueryClient>, organizationId: string) {
  queryClient.invalidateQueries({ queryKey: organizationsQueryKey }).catch(() => undefined)
  queryClient.invalidateQueries({ queryKey: ["organization", organizationId] }).catch(() => undefined)
  queryClient.invalidateQueries({ queryKey: ["giving-plan"] }).catch(() => undefined)
}

export function useAddDonationMutation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { date: string; amount: number; note?: string }) => addDonation(organizationId, input),
    onSuccess: () => invalidateOrganizationQueries(queryClient, organizationId),
  })
}

export function useUpdateDonationMutation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { donationId: string; date?: string; amount?: number; note?: string }) =>
      updateDonation(organizationId, input.donationId, input),
    onSuccess: () => invalidateOrganizationQueries(queryClient, organizationId),
  })
}

export function useDeleteDonationMutation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (donationId: string) => deleteDonation(organizationId, donationId),
    onSuccess: () => invalidateOrganizationQueries(queryClient, organizationId),
  })
}

export function useUpdateOrganizationAddressMutation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (address: OrganizationAddress) => updateOrganizationAddress(organizationId, address),
    onSuccess: () => invalidateOrganizationQueries(queryClient, organizationId),
  })
}
