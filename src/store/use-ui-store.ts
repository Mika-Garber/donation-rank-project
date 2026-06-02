import { create } from "zustand"

export type RankViewMode = "personalized" | "objective"
export const ALL_ORGANIZATIONS_LIST_KEY = "all"

interface UiState {
  rankingListFilter: string
  setRankingListFilter: (rankingListFilter: string) => void
  showOnlyTopTen: boolean
  setShowOnlyTopTen: (showOnlyTopTen: boolean) => void
  rankViewMode: RankViewMode
  setRankViewMode: (rankViewMode: RankViewMode) => void
}

export const useUiStore = create<UiState>((set) => ({
  rankingListFilter: ALL_ORGANIZATIONS_LIST_KEY,
  setRankingListFilter: (rankingListFilter) => set({ rankingListFilter }),
  showOnlyTopTen: true,
  setShowOnlyTopTen: (showOnlyTopTen) => set({ showOnlyTopTen }),
  rankViewMode: "personalized",
  setRankViewMode: (rankViewMode) => set({ rankViewMode }),
}))
