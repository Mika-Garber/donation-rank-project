import { useQuery } from "@tanstack/react-query"
import { getSharedDataStatus } from "../services/api-client"

export const sharedDataStatusQueryKey = ["shared-data-status"] as const

export function useSharedDataStatusQuery() {
  return useQuery({
    queryKey: sharedDataStatusQueryKey,
    queryFn: getSharedDataStatus,
    staleTime: 60_000,
  })
}
