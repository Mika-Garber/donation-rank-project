import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { AdvisorExportRow } from "../utils/advisor-export"

interface AdvisorExportState {
  rows: AdvisorExportRow[]
  setRows: (rows: AdvisorExportRow[] | ((currentRows: AdvisorExportRow[]) => AdvisorExportRow[])) => void
  clearRows: () => void
}

export const useAdvisorExportStore = create<AdvisorExportState>()(
  persist(
    (set) => ({
      rows: [],
      setRows: (rows) =>
        set((state) => ({
          rows: typeof rows === "function" ? rows(state.rows) : rows,
        })),
      clearRows: () => set({ rows: [] }),
    }),
    {
      name: "advisor-export-donation-list",
    },
  ),
)
