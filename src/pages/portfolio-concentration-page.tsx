import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { usePortfolioConcentrationQuery } from "../hooks/use-portfolio-concentration-query"
import type {
  ClientSuggestedAction,
  PortfolioConcentrationGroup,
  PortfolioConcentrationOrganization,
  PortfolioConcentrationOverlapSummary,
  PortfolioRole,
  Recommendation,
} from "../types/organization"
import {
  formatAdvocacyReviewLabel,
  formatLegalVerificationLabel,
  formatResearchStatusLabel,
} from "../utils/ranking-display-labels"

type FilterMode = "all" | "core-picks" | "groups-needing-review" | "overlapping" | "phase-out"
type SortMode = "overlap-group" | "portfolio-role" | "stewardship-score"

const PORTFOLIO_ROLE_ORDER: Record<PortfolioRole, number> = {
  "Core Pick": 1,
  "Category Leader": 2,
  "Unique Mission": 3,
  "Backup Candidate": 4,
  "Review Before Core": 5,
  "Overlapping / Lower Priority": 6,
  "Phase Out Candidate": 7,
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`
}

function formatGift(amount: number): string {
  return amount > 0 ? formatCurrency(amount) : "—"
}

function getClientActionColor(action: ClientSuggestedAction): "default" | "success" | "warning" | "error" {
  if (action === "Keep in final list") return "success"
  if (action === "Strong candidate") return "success"
  if (action === "Review before final list") return "warning"
  if (action === "Similar to stronger charity") return "warning"
  if (action === "Consider reducing") return "error"
  return "error"
}

function getRecommendationColor(recommendation: Recommendation): "default" | "success" | "warning" | "error" {
  if (recommendation === "Priority Fund" || recommendation === "Keep") return "success"
  if (recommendation === "Pause / Do Not Fund") return "error"
  if (recommendation === "Reduce" || recommendation === "Review Before Donating") return "warning"
  return "default"
}

function getPortfolioRoleColor(role: PortfolioRole): "default" | "success" | "warning" | "error" | "info" {
  if (role === "Core Pick") return "success"
  if (role === "Category Leader" || role === "Unique Mission") return "info"
  if (role === "Review Before Core" || role === "Backup Candidate") return "warning"
  if (role === "Phase Out Candidate") return "error"
  return "default"
}

function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, mt: 0.5 }} variant="h5">
        {value}
      </Typography>
      {detail ? (
        <Typography color="text.secondary" sx={{ mt: 0.75 }} variant="body2">
          {detail}
        </Typography>
      ) : null}
    </Paper>
  )
}

function filterGroups(groups: PortfolioConcentrationGroup[], filterMode: FilterMode): PortfolioConcentrationGroup[] {
  if (filterMode === "all") return groups
  if (filterMode === "groups-needing-review") return groups.filter((group) => group.needsReview)
  if (filterMode === "core-picks") {
    return groups
      .map((group) => ({
        ...group,
        organizations: group.organizations.filter((organization) => organization.portfolioRole === "Core Pick"),
      }))
      .filter((group) => group.organizations.length > 0)
  }
  if (filterMode === "overlapping") {
    return groups
      .map((group) => ({
        ...group,
        organizations: group.organizations.filter(
          (organization) =>
            organization.portfolioRole === "Overlapping / Lower Priority" ||
            organization.portfolioRole === "Backup Candidate",
        ),
      }))
      .filter((group) => group.organizations.length > 0)
  }
  return groups
    .map((group) => ({
      ...group,
      organizations: group.organizations.filter((organization) => organization.portfolioRole === "Phase Out Candidate"),
    }))
    .filter((group) => group.organizations.length > 0)
}

function sortGroups(groups: PortfolioConcentrationGroup[], sortMode: SortMode): PortfolioConcentrationGroup[] {
  if (sortMode === "overlap-group") {
    return [...groups].sort((left, right) => left.overlapGroupLabel.localeCompare(right.overlapGroupLabel))
  }

  if (sortMode === "stewardship-score") {
    return [...groups].sort((left, right) => {
      const leftTop = left.organizations[0]?.stewardshipScore ?? 0
      const rightTop = right.organizations[0]?.stewardshipScore ?? 0
      return rightTop - leftTop
    })
  }

  return [...groups].sort((left, right) => {
    const leftRole = left.organizations[0]?.portfolioRole ?? "Phase Out Candidate"
    const rightRole = right.organizations[0]?.portfolioRole ?? "Phase Out Candidate"
    return PORTFOLIO_ROLE_ORDER[leftRole] - PORTFOLIO_ROLE_ORDER[rightRole]
  })
}

function DetailedOrganizationRow({ organization }: { organization: PortfolioConcentrationOrganization }) {
  return (
    <TableRow hover>
      <TableCell>
        <Typography
          component={Link}
          to={`/organizations/${organization.id}`}
          sx={{ color: "primary.main", fontWeight: 600, textDecoration: "none" }}
        >
          {organization.organizationName}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {organization.broadPortfolioArea} · {organization.speciesFocus} · {organization.interventionType.replace(/-/g, " ")}
          {organization.groupingStatus === "needs_manual_review" ? " · Needs Mika review" : ""}
          {organization.secondaryOverlapTags.length > 0
            ? ` · Also: ${organization.secondaryOverlapTags.join(", ")}`
            : ""}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {organization.rankingListLabel} · Group rank #{organization.groupRank}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip label={organization.portfolioRole} color={getPortfolioRoleColor(organization.portfolioRole)} size="small" />
        <Typography color="text.secondary" sx={{ mt: 0.75 }} variant="body2">
          {organization.roleReason}
        </Typography>
      </TableCell>
      <TableCell align="right">{organization.stewardshipScore}</TableCell>
      <TableCell>
        <Chip label={organization.recommendation} color={getRecommendationColor(organization.recommendation)} size="small" />
      </TableCell>
      <TableCell>{formatResearchStatusLabel(organization.rankingStatus)}</TableCell>
      <TableCell>{formatLegalVerificationLabel(organization.legalVerificationStatus)}</TableCell>
      <TableCell>{organization.impactEvidenceLevel}</TableCell>
      <TableCell>{organization.watchdogReviewRequired ? "Review recommended" : "—"}</TableCell>
      <TableCell>{formatAdvocacyReviewLabel(organization.advocacyReviewStatus)}</TableCell>
      <TableCell align="right">{formatGift(organization.approximateAnnualDonation)}</TableCell>
    </TableRow>
  )
}

function DetailedOverlapGroupCard({ group }: { group: PortfolioConcentrationGroup }) {
  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ alignItems: "flex-start", display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "space-between", mb: 1 }}>
        <Box>
          <Typography variant="h6">{group.overlapGroupLabel}</Typography>
          <Typography color="text.secondary" variant="body2">
            {group.broadPortfolioArea} · {group.speciesFocus} · {group.interventionType.replace(/-/g, " ")}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
            {group.organizationCount} {group.organizationCount === 1 ? "charity" : "charities"}
            {group.categoryLeaderName ? ` · Category leader: ${group.categoryLeaderName}` : ""}
            {group.suggestedCorePickName ? ` · Core pick: ${group.suggestedCorePickName}` : ""}
          </Typography>
        </Box>
        {group.needsReview ? <Chip color="warning" label="Needs review" size="small" /> : null}
      </Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {group.suggestedDecisionSummary}
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Organization</TableCell>
              <TableCell>Portfolio role</TableCell>
              <TableCell align="right">Stewardship</TableCell>
              <TableCell>Recommendation</TableCell>
              <TableCell>Research</TableCell>
              <TableCell>Legal</TableCell>
              <TableCell>Impact</TableCell>
              <TableCell>Watchdog</TableCell>
              <TableCell>Advocacy</TableCell>
              <TableCell align="right">Annual gift</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {group.organizations.map((organization) => (
              <DetailedOrganizationRow key={organization.id} organization={organization} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}

function SimilarCharityGroupCard({ group }: { group: PortfolioConcentrationOverlapSummary }) {
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography sx={{ fontWeight: 700 }} variant="h6">
        {group.overlapGroupLabel}
      </Typography>
      <Typography sx={{ mt: 1 }}>
        <Box component="span" sx={{ fontWeight: 600 }}>
          Best current pick:
        </Box>{" "}
        {group.bestCurrentPick ?? "Not identified yet"}
      </Typography>
      {group.similarCharitiesToReview.length > 0 ? (
        <Typography sx={{ mt: 1 }}>
          <Box component="span" sx={{ fontWeight: 600 }}>
            Similar charities to review:
          </Box>{" "}
          {group.similarCharitiesToReview.join(", ")}
        </Typography>
      ) : null}
      <Typography color="text.secondary" sx={{ mt: 1.5 }}>
        {group.suggestedDecision}
      </Typography>
      {group.totalKnownGiving > 0 ? (
        <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
          Known annual giving in this area: {formatCurrency(group.totalKnownGiving)}
        </Typography>
      ) : null}
    </Paper>
  )
}

function DetailedOverlapAnalysis({
  overlapGroups,
}: {
  overlapGroups: PortfolioConcentrationGroup[]
}) {
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [sortMode, setSortMode] = useState<SortMode>("overlap-group")

  const visibleGroups = useMemo(
    () => sortGroups(filterGroups(overlapGroups, filterMode), sortMode),
    [overlapGroups, filterMode, sortMode],
  )

  return (
    <Accordion defaultExpanded={false} disableGutters sx={{ "&::before": { display: "none" } }}>
      <AccordionSummary>
        <Box>
          <Typography variant="h5">Detailed overlap analysis</Typography>
          <Typography color="text.secondary" variant="body2">
            For reviewing the full grouping logic and backup candidates.
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0 }}>
        <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="concentration-filter-label">Filter</InputLabel>
            <Select
              labelId="concentration-filter-label"
              label="Filter"
              value={filterMode}
              onChange={(event) => setFilterMode(event.target.value as FilterMode)}
            >
              <MenuItem value="all">Show all groups</MenuItem>
              <MenuItem value="core-picks">Core Picks only</MenuItem>
              <MenuItem value="groups-needing-review">Groups needing review</MenuItem>
              <MenuItem value="overlapping">Overlapping / lower priority</MenuItem>
              <MenuItem value="phase-out">Phase out candidates</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="concentration-sort-label">Sort</InputLabel>
            <Select
              labelId="concentration-sort-label"
              label="Sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <MenuItem value="overlap-group">By overlap group</MenuItem>
              <MenuItem value="portfolio-role">By portfolio role</MenuItem>
              <MenuItem value="stewardship-score">By stewardship score</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {visibleGroups.length === 0 ? (
          <Typography color="text.secondary">No overlap groups match this filter.</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {visibleGroups.map((group) => (
              <DetailedOverlapGroupCard key={group.overlapGroupKey} group={group} />
            ))}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  )
}

export function PortfolioConcentrationPage() {
  const { data, isLoading, isError } = usePortfolioConcentrationQuery()

  if (isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography>Loading your final 15–20 plan...</Typography>
      </Box>
    )
  }

  if (isError || !data) {
    return <Alert severity="error">Could not load the final 15–20 plan.</Alert>
  }

  const { summary, suggestedFinalList, reviewBeforeFinalDecision, importantOverlapGroups, overlapGroups } = data

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Paper sx={{ p: { md: 4, xs: 3 } }}>
        <Typography gutterBottom variant="h3">
          Final 15–20 Plan
        </Typography>
        <Typography sx={{ fontWeight: 700, mt: 1 }} variant="h5">
          {summary.clientHeadline}
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 760, mt: 1.5 }}>
          {summary.clientSubheadline}
        </Typography>
        {summary.qualifiedVsSuggestedNote ? (
          <Typography color="text.secondary" sx={{ maxWidth: 760, mt: 1.5 }} variant="body2">
            {summary.qualifiedVsSuggestedNote}
          </Typography>
        ) : null}
      </Paper>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { lg: "repeat(4, minmax(0, 1fr))", md: "repeat(2, minmax(0, 1fr))", xs: "1fr" } }}>
        <StatCard label="Total charities reviewed" value={String(summary.totalOrganizationsReviewed)} />
        <StatCard
          label="Current annual giving total"
          value={formatCurrency(summary.totalKnownAnnualGiving)}
          detail={
            summary.missingGiftAmountCount > 0
              ? "Some charities have no annual gift recorded."
              : undefined
          }
        />
        <StatCard label="Suggested final charities" value={String(summary.suggestedFinalListCount)} />
        <StatCard
          label="Giving already in suggested final list"
          value={formatCurrency(summary.suggestedCoreKnownAnnualGiving)}
        />
      </Box>

      <Paper sx={{ p: { md: 3, xs: 2.5 } }}>
        <Typography gutterBottom variant="h4">
          Suggested final list
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          These are the charities we suggest keeping at the center of your giving plan.
        </Typography>
        <Button
          component={Link}
          state={{ organizationIds: suggestedFinalList.map((charity) => charity.id) }}
          sx={{ mb: 2 }}
          to="/advisor-export"
          variant="contained"
        >
          Load into donation list
        </Button>
        {suggestedFinalList.length === 0 ? (
          <Typography color="text.secondary">No suggested final list yet.</Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Charity</TableCell>
                  <TableCell>Area</TableCell>
                  <TableCell>Why it made the list</TableCell>
                  <TableCell align="right">Current gift</TableCell>
                  <TableCell>Suggested action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suggestedFinalList.map((charity) => (
                  <TableRow key={charity.id} hover>
                    <TableCell>
                      <Typography
                        component={Link}
                        to={`/organizations/${charity.id}`}
                        sx={{ color: "primary.main", fontWeight: 600, textDecoration: "none" }}
                      >
                        {charity.organizationName}
                      </Typography>
                    </TableCell>
                    <TableCell>{charity.area}</TableCell>
                    <TableCell>{charity.whyItMadeTheList}</TableCell>
                    <TableCell align="right">{formatGift(charity.currentGift)}</TableCell>
                    <TableCell>
                      <Chip
                        label={charity.suggestedAction}
                        color={getClientActionColor(charity.suggestedAction)}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: { md: 3, xs: 2.5 } }}>
        <Typography gutterBottom variant="h4">
          Needs review before final decision
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Strong charities that are not ready to confidently include until a few questions are resolved.
        </Typography>
        {reviewBeforeFinalDecision.length === 0 ? (
          <Typography color="text.secondary">No charities currently need review before finalizing.</Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Charity</TableCell>
                  <TableCell>Concern</TableCell>
                  <TableCell>What to do next</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reviewBeforeFinalDecision.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography
                        component={Link}
                        to={`/organizations/${item.id}`}
                        sx={{ color: "primary.main", fontWeight: 600, textDecoration: "none" }}
                      >
                        {item.organizationName}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.concern}</TableCell>
                    <TableCell>{item.nextStep}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: { md: 3, xs: 2.5 } }}>
        <Typography gutterBottom variant="h4">
          Similar charities we may not need to keep
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Areas where you may be supporting more than one charity doing similar work.
        </Typography>
        {importantOverlapGroups.length === 0 ? (
          <Typography color="text.secondary">No important overlap areas to review right now.</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {importantOverlapGroups.map((group) => (
              <SimilarCharityGroupCard key={group.overlapGroupLabel} group={group} />
            ))}
          </Box>
        )}
      </Paper>

      <DetailedOverlapAnalysis overlapGroups={overlapGroups} />
    </Box>
  )
}
