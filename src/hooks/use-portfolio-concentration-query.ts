import { useQuery } from "@tanstack/react-query"
import { getPortfolioConcentration } from "../services/api-client"

export function usePortfolioConcentrationQuery() {
  return useQuery({
    queryKey: ["portfolio-concentration"],
    queryFn: getPortfolioConcentration,
  })
}
