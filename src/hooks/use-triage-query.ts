import { useQuery } from "@tanstack/react-query"
import { getTriageQueue } from "../services/api-client"

export function useTriageQuery(limit = 20) {
  return useQuery({
    queryKey: ["triage-queue", limit],
    queryFn: () => getTriageQueue(limit),
  })
}
