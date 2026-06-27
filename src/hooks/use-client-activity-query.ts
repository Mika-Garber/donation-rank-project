import { useQuery } from "@tanstack/react-query"
import { getClientActivity } from "../services/api-client"

export const clientActivityQueryKey = ["client-activity"] as const

export function useClientActivityQuery(limit = 100) {
  return useQuery({
    queryKey: [...clientActivityQueryKey, limit],
    queryFn: () => getClientActivity(limit),
    staleTime: 15_000,
  })
}
