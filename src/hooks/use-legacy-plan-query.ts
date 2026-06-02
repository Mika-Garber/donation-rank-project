import { useQuery } from "@tanstack/react-query"
import { getLegacyPlan } from "../services/api-client"

export function useLegacyPlanQuery() {
  return useQuery({
    queryKey: ["legacy-plan"],
    queryFn: getLegacyPlan,
  })
}
