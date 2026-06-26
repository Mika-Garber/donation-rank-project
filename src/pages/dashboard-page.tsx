import {
  Alert,
  Autocomplete,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from "@mui/material"
import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { OrganizationCard } from "../components/organization-card/organization-card"
import { useOrganizationsQuery } from "../hooks/use-organizations-query"
import { usePortfolioConcentrationQuery } from "../hooks/use-portfolio-concentration-query"
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
  const location = useLocation()
  const { data, isLoading, isError } = useOrganizationsQuery()
  const portfolioConcentrationQuery = usePortfolioConcentrationQuery()
  const rankingListFilter = useUiStore((state) => state.rankingListFilter)
  const setRankingListFilter = useUiStore((state) => state.setRankingListFilter)
  const showOnlyTopTen = useUiStore((state) => state.showOnlyTopTen)
  const setShowOnlyTopTen = useUiStore((state) => state.setShowOnlyTopTen)
  const showOnlyFinalPortfolio = useUiStore((state) => state.showOnlyFinalPortfolio)
  const setShowOnlyFinalPortfolio = useUiStore((state) => state.setShowOnlyFinalPortfolio)
  const rankViewMode = useUiStore((state) => state.rankViewMode)
  const setRankViewMode = useUiStore((state) => state.setRankViewMode)
  const dashboardSortMode = useUiStore((state) => state.dashboardSortMode)
  const setDashboardSortMode = useUiStore((state) => state.setDashboardSortMode)
  const [searchSelection, setSearchSelection] = useState<Organization | null>(null)
  const [pendingScrollOrganizationId, setPendingScrollOrganizationId] = useState<string | null>(null)
  const [highlightedOrganizationId, setHighlightedOrganizationId] = useState<string | null>(null)
  const focusedOrganizationIdRef = useRef<string | null>(null)

  const organizations = data ?? []
  const finalPortfolioIds = useMemo(
    () => new Set((portfolioConcentrationQuery.data?.suggestedFinalList ?? []).map((charity) => charity.id)),
    [portfolioConcentrationQuery.data],
  )
  const finalPortfolioCount = finalPortfolioIds.size
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

  const filteredOrganizations = useMemo(() => {
    const filtered = organizations.filter((item) => {
      if (rankingListFilter !== ALL_ORGANIZATIONS_LIST_KEY && item.rankingListKey !== rankingListFilter) {
        return false
      }
      if (showOnlyFinalPortfolio && !finalPortfolioIds.has(item.id)) {
        return false
      }
      return true
    })

    if (dashboardSortMode === "alphabetical") {
      return [...filtered].sort((left, right) => left.organizationName.localeCompare(right.organizationName))
    }

    return [...filtered].sort(
      (left, right) => getDisplayRank(left, rankViewMode, rankingListFilter) - getDisplayRank(right, rankViewMode, rankingListFilter),
    )
  }, [organizations, rankingListFilter, dashboardSortMode, rankViewMode, showOnlyFinalPortfolio, finalPortfolioIds])

  const visibleOrganizations = showOnlyTopTen ? filteredOrganizations.slice(0, 10) : filteredOrganizations

  useEffect(() => {
    if (!pendingScrollOrganizationId) return

    const timeoutId = window.setTimeout(() => {
      const element = document.getElementById(`organization-card-${pendingScrollOrganizationId}`)
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" })
        setHighlightedOrganizationId(pendingScrollOrganizationId)
        setPendingScrollOrganizationId(null)
        window.setTimeout(() => setHighlightedOrganizationId(null), 2500)
        return
      }

      setPendingScrollOrganizationId(null)
    }, 100)

    return () => window.clearTimeout(timeoutId)
  }, [pendingScrollOrganizationId, visibleOrganizations, rankingListFilter, showOnlyTopTen, dashboardSortMode])

  function handleSearchSelect(organization: Organization | null): void {
    setSearchSelection(organization)
    if (!organization) return

    if (rankingListFilter !== ALL_ORGANIZATIONS_LIST_KEY && organization.rankingListKey !== rankingListFilter) {
      setRankingListFilter(organization.rankingListKey)
    }

    if (showOnlyFinalPortfolio && !finalPortfolioIds.has(organization.id)) {
      setShowOnlyFinalPortfolio(false)
    }

    setShowOnlyTopTen(false)
    setPendingScrollOrganizationId(organization.id)
  }

  useEffect(() => {
    const focusOrganizationId = (location.state as { focusOrganizationId?: string } | null)?.focusOrganizationId
    if (!focusOrganizationId || organizations.length === 0) return
    if (focusedOrganizationIdRef.current === focusOrganizationId) return

    const organization = organizations.find((item) => item.id === focusOrganizationId)
    if (!organization) return

    focusedOrganizationIdRef.current = focusOrganizationId
    if (rankingListFilter !== ALL_ORGANIZATIONS_LIST_KEY && organization.rankingListKey !== rankingListFilter) {
      setRankingListFilter(organization.rankingListKey)
    }
    if (showOnlyFinalPortfolio && !finalPortfolioIds.has(organization.id)) {
      setShowOnlyFinalPortfolio(false)
    }
    setShowOnlyTopTen(false)
    setSearchSelection(organization)
    setPendingScrollOrganizationId(organization.id)
    window.history.replaceState({}, document.title)
  }, [location.state, organizations, rankingListFilter, setRankingListFilter, setShowOnlyFinalPortfolio, setShowOnlyTopTen, showOnlyFinalPortfolio, finalPortfolioIds])

  const completeCount = organizations.filter((item) => item.researchStatus === "complete").length
  const partialCount = organizations.filter((item) => item.researchStatus === "partial").length
  const failedCount = organizations.filter((item) => item.researchStatus === "failed").length
  const latestRefresh = organizations
    .map((item) => item.lastRefreshedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const preliminaryCount = organizations.filter((item) => item.rankingStatus === "Preliminary").length
  const notResearchedCount = organizations.filter((item) => item.rankingStatus === "Not Researched").length

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
          Dashboard
        </Typography>
        <Typography color="text.secondary">
          Organizations are ranked within mission-bucket lists by stewardship score so similar charities are compared fairly. You can also view all organizations together.
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Viewing: {selectedListLabel}
          {showOnlyFinalPortfolio ? ` • Final 15–20 only (${finalPortfolioCount})` : ""} •{" "}
          {rankViewMode === "personalized" ? "Personalized rank" : "Objective rank"} •{" "}
          {dashboardSortMode === "alphabetical" ? "Alphabetical A–Z" : "Stewardship rank order"}
        </Typography>
        <Alert severity="info" sx={{ mt: 1.5 }}>
          <Typography variant="body2">
            Recommendation and confidence come first. Stewardship score summarizes comparable financial and accountability data. Impact evidence level and review flags explain what the score does not capture. Use list rank within a mission bucket — not global rank alone.
            Objective rank is the default. Personalized rank (optional) adds a small capped boost from prior giving history.
          </Typography>
        </Alert>
        {(preliminaryCount > 0 || notResearchedCount > 0) && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            Some organizations still need research — finish core fields before treating list rank as final.
          </Alert>
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
          <Typography variant="body2">Research complete: {completeCount}</Typography>
          <Typography variant="body2">Research partial: {partialCount}</Typography>
          <Typography variant="body2">Research failed: {failedCount}</Typography>
          <Typography variant="body2">Preliminary: {preliminaryCount}</Typography>
          <Typography variant="body2">Not researched: {notResearchedCount}</Typography>
          <Typography variant="body2">
            Last research run: {latestRefresh ? new Date(latestRefresh).toLocaleString() : "Not yet"}
          </Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Autocomplete
          options={organizations}
          value={searchSelection}
          onChange={(_event, organization) => handleSearchSelect(organization)}
          getOptionLabel={(organization) => organization.organizationName}
          isOptionEqualToValue={(left, right) => left.id === right.id}
          renderInput={(params) => <TextField {...params} label="Search charities" placeholder="Type a charity name..." />}
          renderOption={(props, organization) => (
            <Box component="li" {...props} key={organization.id}>
              <Box>
                <Typography>{organization.organizationName}</Typography>
                <Typography color="text.secondary" variant="caption">
                  {organization.rankingListLabel}
                </Typography>
              </Box>
            </Box>
          )}
          sx={{ mb: 2 }}
        />
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
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="dashboard-sort-label">Sort by</InputLabel>
            <Select
              labelId="dashboard-sort-label"
              label="Sort by"
              value={dashboardSortMode}
              onChange={(event) => setDashboardSortMode(event.target.value as "rank" | "alphabetical")}
            >
              <MenuItem value="rank">Current stewardship/list ranking</MenuItem>
              <MenuItem value="alphabetical">Alphabetical A–Z</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
            <Switch
              checked={showOnlyFinalPortfolio}
              disabled={finalPortfolioCount === 0}
              onChange={(_event, checked) => setShowOnlyFinalPortfolio(checked)}
            />
            <Typography>
              {showOnlyFinalPortfolio
                ? `Final 15–20 only (${filteredOrganizations.length})`
                : `Only Final 15–20 charities (${finalPortfolioCount})`}
            </Typography>
          </Box>
          <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
            <Switch checked={showOnlyTopTen} onChange={(_event, checked) => setShowOnlyTopTen(checked)} />
            <Typography>{showOnlyTopTen ? "Showing Top 10" : "Showing all"}</Typography>
          </Box>
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
            highlighted={highlightedOrganizationId === organization.id}
          />
        ))}
      </Box>
    </Box>
  )
}
