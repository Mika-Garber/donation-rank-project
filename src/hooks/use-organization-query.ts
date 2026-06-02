import { useQuery } from "@tanstack/react-query"
import { getOrganizationById } from "../services/api-client"

export function useOrganizationQuery(id: string) {
  return useQuery({
    queryKey: ["organization", id],
    queryFn: () => getOrganizationById(id),
    enabled: Boolean(id),
  })
}
