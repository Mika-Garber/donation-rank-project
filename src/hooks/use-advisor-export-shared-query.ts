import { useQuery } from "@tanstack/react-query"
import { getSharedAdvisorExportRows } from "../services/api-client"

export const advisorExportSharedQueryKey = ["advisor-export-shared"] as const

export function useAdvisorExportSharedQuery(enabled: boolean) {
  return useQuery({
    queryKey: advisorExportSharedQueryKey,
    queryFn: getSharedAdvisorExportRows,
    enabled,
    staleTime: 10_000,
  })
}
