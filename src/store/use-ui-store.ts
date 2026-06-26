import { create } from "zustand"

export type RankViewMode = "personalized" | "objective"
export type DashboardSortMode = "rank" | "alphabetical"
export const ALL_ORGANIZATIONS_LIST_KEY = "all"

interface UiState {
  rankingListFilter: string
  setRankingListFilter: (rankingListFilter: string) => void
  showOnlyTopTen: boolean
  setShowOnlyTopTen: (showOnlyTopTen: boolean) => void
  showOnlyFinalPortfolio: boolean
  setShowOnlyFinalPortfolio: (showOnlyFinalPortfolio: boolean) => void
  rankViewMode: RankViewMode
  setRankViewMode: (rankViewMode: RankViewMode) => void
  dashboardSortMode: DashboardSortMode
  setDashboardSortMode: (dashboardSortMode: DashboardSortMode) => void
}

export const useUiStore = create<UiState>((set) => ({
  rankingListFilter: ALL_ORGANIZATIONS_LIST_KEY,
  setRankingListFilter: (rankingListFilter) => set({ rankingListFilter }),
  showOnlyTopTen: true,
  setShowOnlyTopTen: (showOnlyTopTen) => set({ showOnlyTopTen }),
  showOnlyFinalPortfolio: false,
  setShowOnlyFinalPortfolio: (showOnlyFinalPortfolio) => set({ showOnlyFinalPortfolio }),
  rankViewMode: "objective",
  setRankViewMode: (rankViewMode) => set({ rankViewMode }),
  dashboardSortMode: "rank",
  setDashboardSortMode: (dashboardSortMode) => set({ dashboardSortMode }),
}))
