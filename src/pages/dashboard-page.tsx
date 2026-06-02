import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Typography,
} from "@mui/material"
import { useMemo } from "react"
import { OrganizationCard } from "../components/organization-card/organization-card"
import { useOrganizationsQuery } from "../hooks/use-organizations-query"
import { useTriageQuery } from "../hooks/use-triage-query"
import { ALL_ORGANIZATIONS_LIST_KEY, useUiStore } from "../store/use-ui-store"
import type { Organization } from "../types/organization"

function getDisplayRank(organization: Organization, rankViewMode: "personalized" | "objective", listFilter: string): number {
  const useGlobalRanks = listFilter === ALL_ORGANIZATIONS_LIST_KEY
  if (rankViewMode === "objective") {
    return useGlobalRanks ? organization.globalObjectiveRank : organization.listObjectiveRank
  }
  return useGlobalRanks ? organization.globalPersonalizedRank : organization.listPersonalizedRank
}

export function DashboardPage() {
  const { data, isLoading, isError } = useOrganizationsQuery()
  const triageQuery = useTriageQuery(12)
  const rankingListFilter = useUiStore((state) => state.rankingListFilter)
  const setRankingListFilter = useUiStore((state) => state.setRankingListFilter)
  const showOnlyTopTen = useUiStore((state) => state.showOnlyTopTen)
  const setShowOnlyTopTen = useUiStore((state) => state.setShowOnlyTopTen)
  const rankViewMode = useUiStore((state) => state.rankViewMode)
  const setRankViewMode = useUiStore((state) => state.setRankViewMode)

  const organizations = data ?? []
  const rankingLists = useMemo(() => {
    const listMap = new Map<string, { key: string; label: string; organizationCount: number }>()
    for (const organization of organizations) {
      const existing = listMap.get(organization.rankingListKey)
      if (existing) {
        existing.organizationCount += 1
      } else {
        listMap.set(organization.rankingListKey, {
          key: organization.rankingListKey,
          label: organization.rankingListLabel,
          organizationCount: 1,
        })
      }
    }
    return Array.from(listMap.values()).sort((left, right) => {
      if (right.organizationCount !== left.organizationCount) {
        return right.organizationCount - left.organizationCount
      }
      return left.label.localeCompare(right.label)
    })
  }, [organizations])

  const selectedListLabel =
    rankingListFilter === ALL_ORGANIZATIONS_LIST_KEY
      ? "All organizations"
      : rankingLists.find((list) => list.key === rankingListFilter)?.label ?? "Selected list"

  const filteredOrganizations = organizations
    .filter((item) => rankingListFilter === ALL_ORGANIZATIONS_LIST_KEY || item.rankingListKey === rankingListFilter)
    .sort((left, right) => getDisplayRank(left, rankViewMode, rankingListFilter) - getDisplayRank(right, rankViewMode, rankingListFilter))

  const visibleOrganizations = showOnlyTopTen ? filteredOrganizations.slice(0, 10) : filteredOrganizations
  const completeCount = organizations.filter((item) => item.researchStatus === "complete").length
  const partialCount = organizations.filter((item) => item.researchStatus === "partial").length
  const failedCount = organizations.filter((item) => item.researchStatus === "failed").length
  const latestRefresh = organizations
    .map((item) => item.lastRefreshedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const preliminaryOnlyCount = organizations.filter((item) => item.rankingStatus === "Preliminary Only").length

  if (isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography>Loading rankings...</Typography>
      </Box>
    )
  }

  if (isError) {
    return <Alert severity="error">Could not load rankings. Please verify the API server is running.</Alert>
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="h4" gutterBottom>
          Donation Worthiness Dashboard
        </Typography>
        <Typography color="text.secondary">
          Organizations are ranked within mission-bucket lists so similar charities are compared fairly. You can also view all organizations together.
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Viewing: {selectedListLabel} • {rankViewMode === "personalized" ? "Personalized rank" : "Objective rank"}
        </Typography>
        <Alert severity="info" sx={{ mt: 1.5 }}>
          <Typography variant="body2">
            List rank compares charities in the same mission area and subcategory. Global rank compares every organization on your list.
            Personalized rank adds a small capped donor-confidence boost from prior giving history.
          </Typography>
        </Alert>
        {preliminaryOnlyCount > 0 && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            Preliminary score only — not enough verified data for final ranking.
          </Alert>
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
          <Typography variant="body2">Research complete: {completeCount}</Typography>
          <Typography variant="body2">Research partial: {partialCount}</Typography>
          <Typography variant="body2">Research failed: {failedCount}</Typography>
          <Typography variant="body2">Preliminary only: {preliminaryOnlyCount}</Typography>
          <Typography variant="body2">
            Last research run: {latestRefresh ? new Date(latestRefresh).toLocaleString() : "Not yet"}
          </Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Box
          sx={{
            alignItems: { md: "center", xs: "flex-start" },
            display: "flex",
            flexDirection: { md: "row", xs: "column" },
            gap: 2,
          }}
        >
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel id="ranking-list-filter-label">Ranking list</InputLabel>
            <Select
              labelId="ranking-list-filter-label"
              label="Ranking list"
              value={rankingListFilter}
              onChange={(event) => setRankingListFilter(event.target.value)}
            >
              <MenuItem value={ALL_ORGANIZATIONS_LIST_KEY}>All organizations ({organizations.length})</MenuItem>
              {rankingLists.map((list) => (
                <MenuItem key={list.key} value={list.key}>
                  {list.label} ({list.organizationCount})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="rank-view-label">List Mode</InputLabel>
            <Select
              labelId="rank-view-label"
              label="List Mode"
              value={rankViewMode}
              onChange={(event) => setRankViewMode(event.target.value as "personalized" | "objective")}
            >
              <MenuItem value="personalized">Personalized Rank</MenuItem>
              <MenuItem value="objective">Objective Rank</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
            <Switch checked={showOnlyTopTen} onChange={(_event, checked) => setShowOnlyTopTen(checked)} />
            <Typography>{showOnlyTopTen ? "Showing Top 10" : "Showing all"}</Typography>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>
          Manual review queue (top priority only)
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>
          Review this short list weekly to keep gifts focused and avoid spreading donations too thin.
        </Typography>
        {triageQuery.isLoading && <Typography>Loading triage queue...</Typography>}
        {triageQuery.isError && <Alert severity="warning">Could not load triage queue.</Alert>}
        {!triageQuery.isLoading && !triageQuery.data?.length && <Typography>No triage items right now.</Typography>}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {(triageQuery.data ?? []).slice(0, 8).map((item) => (
            <Box
              key={item.id}
              sx={{ alignItems: "center", border: "1px solid #e3e7ef", borderRadius: 1.5, display: "flex", gap: 1.5, p: 1 }}
            >
              <Typography sx={{ flex: 1 }}>{item.organizationName}</Typography>
              <Typography variant="body2">Priority {item.triagePriority}</Typography>
              <Typography variant="body2">Worth {item.donationWorthinessScore}</Typography>
              <Typography variant="body2">Conf {item.confidenceScore}%</Typography>
              <Typography variant="body2">Missing {item.missingFieldsCount}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { md: "repeat(2, minmax(0, 1fr))", xs: "repeat(1, minmax(0, 1fr))" },
        }}
      >
        {visibleOrganizations.map((organization) => (
          <OrganizationCard
            key={organization.id}
            organization={organization}
            rankViewMode={rankViewMode}
            showGlobalRanks={rankingListFilter === ALL_ORGANIZATIONS_LIST_KEY}
          />
        ))}
      </Box>
    </Box>
  )
}
