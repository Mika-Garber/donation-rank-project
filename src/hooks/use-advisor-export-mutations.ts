import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  logAdvisorExportGenerated,
  removeSharedAdvisorExportRow,
  replaceSharedAdvisorExportRows,
  updateSharedAdvisorExportRow,
} from "../services/api-client"
import { advisorExportRowToSharedItemInput, type AdvisorExportRow } from "../utils/advisor-export"
import { advisorExportSharedQueryKey } from "./use-advisor-export-shared-query"
import { clientActivityQueryKey } from "./use-client-activity-query"

export function useReplaceSharedAdvisorExportMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (rows: AdvisorExportRow[]) =>
      replaceSharedAdvisorExportRows(rows.map((row) => advisorExportRowToSharedItemInput(row))),
    onSuccess: (rows) => {
      queryClient.setQueryData(advisorExportSharedQueryKey, rows)
      void queryClient.invalidateQueries({ queryKey: clientActivityQueryKey })
    },
  })
}

export function useUpdateSharedAdvisorExportRowMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (row: AdvisorExportRow) =>
      updateSharedAdvisorExportRow(row.organizationId, advisorExportRowToSharedItemInput(row)),
    onSuccess: (updatedRow) => {
      queryClient.setQueryData<AdvisorExportRow[]>(advisorExportSharedQueryKey, (current) => {
        if (!current) return [updatedRow]
        return current.map((row) => (row.organizationId === updatedRow.organizationId ? updatedRow : row))
      })
      void queryClient.invalidateQueries({ queryKey: clientActivityQueryKey })
    },
  })
}

export function useRemoveSharedAdvisorExportRowMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (organizationId: string) => removeSharedAdvisorExportRow(organizationId),
    onSuccess: (_result, organizationId) => {
      queryClient.setQueryData<AdvisorExportRow[]>(advisorExportSharedQueryKey, (current) =>
        current ? current.filter((row) => row.organizationId !== organizationId) : current,
      )
      void queryClient.invalidateQueries({ queryKey: clientActivityQueryKey })
    },
  })
}

export function useLogAdvisorExportGeneratedMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logAdvisorExportGenerated,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientActivityQueryKey })
    },
  })
}
