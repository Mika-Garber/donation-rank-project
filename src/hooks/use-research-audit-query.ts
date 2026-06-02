import { useQuery } from "@tanstack/react-query"
import { getResearchAudit } from "../services/api-client"

export function useResearchAuditQuery() {
  return useQuery({
    queryKey: ["research-audit"],
    queryFn: getResearchAudit,
  })
}
