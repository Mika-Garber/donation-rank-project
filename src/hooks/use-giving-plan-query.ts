import { useQuery } from "@tanstack/react-query"
import { getGivingPlan } from "../services/api-client"

export function useGivingPlanQuery() {
  return useQuery({
    queryKey: ["giving-plan"],
    queryFn: getGivingPlan,
  })
}
