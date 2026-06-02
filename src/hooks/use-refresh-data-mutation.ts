import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getRefreshStatus, refreshOnlineData } from "../services/api-client"
import { organizationsQueryKey } from "./use-organizations-query"

export function useRefreshStatusQuery() {
  return useQuery({
    queryKey: ["refresh-status"],
    queryFn: getRefreshStatus,
  })
}

export function useRefreshDataMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: refreshOnlineData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationsQueryKey }).catch(() => undefined)
      queryClient.invalidateQueries({ queryKey: ["refresh-status"] }).catch(() => undefined)
    },
  })
}
