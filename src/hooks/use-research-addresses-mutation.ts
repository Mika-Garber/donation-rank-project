import { useMutation, useQueryClient } from "@tanstack/react-query"
import { researchAllOrganizationAddresses } from "../services/api-client"
import { organizationsQueryKey } from "./use-organizations-query"

export function useResearchAddressesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: researchAllOrganizationAddresses,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationsQueryKey }).catch(() => undefined)
      queryClient.invalidateQueries({ queryKey: ["organization"] }).catch(() => undefined)
    },
  })
}
