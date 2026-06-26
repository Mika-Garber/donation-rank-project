import { useMutation, useQueryClient } from "@tanstack/react-query"
import { researchImpactFrom990s, researchOrganization, runFreeResearch, updateOrganizationMissionOverlap, updateOrganizationResearchNotes } from "../services/api-client"
import { organizationsQueryKey } from "./use-organizations-query"

function invalidateOrganizationQueries(queryClient: ReturnType<typeof useQueryClient>, organizationId: string) {
  queryClient.invalidateQueries({ queryKey: organizationsQueryKey }).catch(() => undefined)
  queryClient.invalidateQueries({ queryKey: ["organization", organizationId] }).catch(() => undefined)
  queryClient.invalidateQueries({ queryKey: ["giving-plan"] }).catch(() => undefined)
  queryClient.invalidateQueries({ queryKey: ["research-audit"] }).catch(() => undefined)
  queryClient.invalidateQueries({ queryKey: ["triage"] }).catch(() => undefined)
  queryClient.invalidateQueries({ queryKey: ["portfolio-review"] }).catch(() => undefined)
}

export function useUpdateOrganizationMissionOverlapMutation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      duplicateMission?: string
      duplicateMissionGroup?: string
      duplicateMissionRole?: "" | "primary" | "secondary" | "phasing-out"
    }) => updateOrganizationMissionOverlap(organizationId, input),
    onSuccess: () => invalidateOrganizationQueries(queryClient, organizationId),
  })
}

export function useUpdateOrganizationResearchNotesMutation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      impactEvidenceNotes?: string
      accountabilityNotes?: string
      politicalInvolvementNotes?: string
    }) => updateOrganizationResearchNotes(organizationId, input),
    onSuccess: () => invalidateOrganizationQueries(queryClient, organizationId),
  })
}

export function useResearchImpactFrom990sMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input?: { force?: boolean; mergeManualNotes?: boolean }) => researchImpactFrom990s(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationsQueryKey }).catch(() => undefined)
      queryClient.invalidateQueries({ queryKey: ["research-audit"] }).catch(() => undefined)
      queryClient.invalidateQueries({ queryKey: ["triage"] }).catch(() => undefined)
    },
  })
}

export function useRunFreeResearchMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: runFreeResearch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationsQueryKey }).catch(() => undefined)
      queryClient.invalidateQueries({ queryKey: ["refresh-status"] }).catch(() => undefined)
      queryClient.invalidateQueries({ queryKey: ["research-audit"] }).catch(() => undefined)
      queryClient.invalidateQueries({ queryKey: ["triage"] }).catch(() => undefined)
      queryClient.invalidateQueries({ queryKey: ["portfolio-review"] }).catch(() => undefined)
    },
  })
}

export function useResearchOrganizationMutation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => researchOrganization(organizationId),
    onSuccess: () => invalidateOrganizationQueries(queryClient, organizationId),
  })
}
