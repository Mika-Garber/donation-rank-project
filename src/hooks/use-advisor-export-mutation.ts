import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateOrganizationAdvisorExportBatch } from "../services/api-client"
import type { AdvisorExportInput } from "../types/organization"

export function useAdvisorExportMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (items: Array<{ organizationId: string; input: AdvisorExportInput }>) =>
      updateOrganizationAdvisorExportBatch(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
    },
  })
}
