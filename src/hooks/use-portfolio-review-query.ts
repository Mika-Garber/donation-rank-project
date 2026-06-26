import { useQuery } from "@tanstack/react-query"
import { getPortfolioReview } from "../services/api-client"

export function usePortfolioReviewQuery() {
  return useQuery({
    queryKey: ["portfolio-review"],
    queryFn: getPortfolioReview,
  })
}
