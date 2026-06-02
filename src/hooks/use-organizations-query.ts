import { useQuery } from "@tanstack/react-query"
import { getOrganizations } from "../services/api-client"

export const organizationsQueryKey = ["organizations"]

export function useOrganizationsQuery() {
  return useQuery({
    queryKey: organizationsQueryKey,
    queryFn: getOrganizations,
  })
}
