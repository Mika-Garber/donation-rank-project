import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createOrganization } from "../services/api-client"
import { organizationsQueryKey } from "./use-organizations-query"

export function useCreateOrganizationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationsQueryKey }).catch(() => undefined)
    },
  })
}
