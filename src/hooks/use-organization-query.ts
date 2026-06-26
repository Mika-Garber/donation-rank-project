import { useQuery } from "@tanstack/react-query"
import { getOrganizationById } from "../services/api-client"

export function organizationQueryKey(id: string) {
  return ["organization", id] as const
}

export function useOrganizationQuery(id: string) {
  return useQuery({
    queryKey: organizationQueryKey(id),
    queryFn: () => getOrganizationById(id),
    enabled: Boolean(id),
  })
}
