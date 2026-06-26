import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import { Link } from "react-router-dom"
import { usePortfolioReviewQuery } from "../hooks/use-portfolio-review-query"
import type { PortfolioReviewOrganizationSummary, Recommendation } from "../types/organization"
import { formatResearchStatusLabel } from "../utils/ranking-display-labels"

function getRecommendationColor(recommendation: Recommendation): "default" | "success" | "warning" | "error" {
  if (recommendation === "Priority Fund" || recommendation === "Keep") return "success"
  if (recommendation === "Pause / Do Not Fund") return "error"
  if (recommendation === "Reduce" || recommendation === "Review Before Donating") return "warning"
  return "default"
}

function PortfolioReviewTable({
  title,
  description,
  organizations,
  emptyMessage,
}: {
  title: string
  description: string
  organizations: PortfolioReviewOrganizationSummary[]
  emptyMessage: string
}) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>
      {organizations.length === 0 ? (
        <Typography color="text.secondary">{emptyMessage}</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Organization</TableCell>
                <TableCell align="right">Annual gift</TableCell>
                <TableCell align="right">% of total</TableCell>
                <TableCell>Stewardship</TableCell>
                <TableCell align="right">Impact level</TableCell>
                <TableCell>List rank</TableCell>
                <TableCell>Impact source</TableCell>
                <TableCell>Recommendation</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Flag</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {organizations.map((organization) => (
                <TableRow key={organization.id} hover>
                  <TableCell>
                    <Typography
                      component={Link}
                      to={`/organizations/${organization.id}`}
                      sx={{ color: "primary.main", fontWeight: 600, textDecoration: "none" }}
                    >
                      {organization.organizationName}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {organization.rankingListLabel}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">${organization.approximateAnnualDonation.toLocaleString()}</TableCell>
                  <TableCell align="right">{organization.giftSharePercent}%</TableCell>
                  <TableCell>
                    {organization.stewardshipScoreLabel}
                    <Typography color="text.secondary" variant="body2">
                      {organization.confidenceBand} ({organization.confidenceScore}%)
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {organization.impactEvidenceLevel}
                    <Typography color="text.secondary" variant="body2">
                      {organization.quantifiedOutcomeCount} outcomes
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {organization.listRankLabel}
                  </TableCell>
                  <TableCell>{organization.impactSourceTierLabel}</TableCell>
                  <TableCell>
                    <Chip label={organization.recommendation} color={getRecommendationColor(organization.recommendation)} size="small" />
                  </TableCell>
                  <TableCell>{formatResearchStatusLabel(organization.rankingStatus)}</TableCell>
                  <TableCell>
                    {organization.reviewFlag ? (
                      <Typography color="warning.main" variant="body2">
                        {organization.reviewFlag}
                      </Typography>
                    ) : organization.legacyEligible ? (
                      <Typography color="success.main" variant="body2">
                        {organization.legacyTier}
                      </Typography>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  )
}

export function PortfolioReviewPage() {
  const { data, isLoading, isError } = usePortfolioReviewQuery()

  if (isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography>Loading portfolio review...</Typography>
      </Box>
    )
  }

  if (isError || !data) {
    return <Alert severity="error">Could not load portfolio review.</Alert>
  }

  const { consolidation } = data

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ alignItems: "flex-start", display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Portfolio Review
            </Typography>
            <Typography color="text.secondary">
              A donor-focused view: where money goes today, what deserves continued support, and what needs a closer look
              before the next gift.
            </Typography>
          </Box>
          <Button component={Link} to="/print/portfolio-review" variant="outlined">
            Printable summary
          </Button>
        </Box>
      </Paper>

      <Alert severity={consolidation.excessContinueCount > 0 ? "warning" : "info"}>
        <Typography sx={{ fontWeight: 600 }}>{consolidation.headline}</Typography>
        <Typography sx={{ mt: 0.75 }}>{consolidation.guidance}</Typography>
      </Alert>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Consolidation snapshot
        </Typography>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { md: "repeat(3, minmax(0, 1fr))", xs: "1fr" } }}>
          <Typography>Total organizations: {consolidation.totalOrganizations}</Typography>
          <Typography>Total annual giving: ${consolidation.totalAnnualGiving.toLocaleString()}</Typography>
          <Typography>
            Keep / Priority Fund: {consolidation.continueRecommendationCount} ({consolidation.priorityFundCount} priority,{" "}
            {consolidation.keepCount} keep)
          </Typography>
          <Typography>
            Continue gifts: ${consolidation.continueAnnualGiving.toLocaleString()} ({consolidation.continueGivingSharePercent}% of total)
          </Typography>
          <Typography>Review / reduce / pause: {consolidation.reviewOrReduceCount}</Typography>
          <Typography>
            Legacy eligible: {consolidation.legacyEligibleCount} ({consolidation.legacyCoreCount} core)
          </Typography>
          <Typography>
            Suggested focus range: {consolidation.suggestedFocusMin}–{consolidation.suggestedFocusMax} core charities
          </Typography>
        </Box>
      </Paper>

      <PortfolioReviewTable
        title="Top 20 by annual gift"
        description="Start here when deciding what to keep, reduce, or pause. Annual gift is shown beside evidence and recommendation."
        organizations={data.topByAnnualGift}
        emptyMessage="No annual gifts recorded yet."
      />

      <PortfolioReviewTable
        title="High-gift review flags"
        description="These organizations receive meaningful annual gifts but are not Priority Fund or Keep. Review together before the next gift."
        organizations={data.highGiftOutliers}
        emptyMessage="No high-gift outliers right now."
      />

      {data.missionOverlapGroups.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Mission overlap groups
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Organizations tagged with the same overlap group id. Mark one as primary and consider reducing peers in the
            group.
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {data.missionOverlapGroups.map((group) => (
              <Box key={group.groupId} sx={{ border: "1px solid #e3e7ef", borderRadius: 1.5, p: 2 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {group.groupLabel} ({group.organizationCount} orgs, ${group.totalAnnualGiving.toLocaleString()}/yr)
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  {group.consolidationNote}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: 1 }}>
                  {group.organizations.map((organization) => (
                    <Typography key={organization.id}>
                      •{" "}
                      <Typography component={Link} to={`/organizations/${organization.id}`} sx={{ fontWeight: 600 }}>
                        {organization.organizationName}
                      </Typography>{" "}
                      — ${organization.approximateAnnualDonation.toLocaleString()} —{" "}
                      {organization.duplicateMissionRole || "role not set"} — {organization.recommendation}
                    </Typography>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {data.ungroupedDuplicateFlags.length > 0 && (
        <PortfolioReviewTable
          title="Overlaps flagged but not grouped"
          description="These are marked as overlapping mission (Y) but do not have a group id yet. Add a shared group id on the organization page."
          organizations={data.ungroupedDuplicateFlags}
          emptyMessage=""
        />
      )}

      <PortfolioReviewTable
        title="Suggested core candidates"
        description={`Up to ${consolidation.suggestedFocusMax} Priority Fund organizations with research-complete rankings — a starting shortlist for consolidation.`}
        organizations={data.suggestedCoreCandidates}
        emptyMessage="No research-complete Priority Fund candidates yet."
      />

      <PortfolioReviewTable
        title="Research gaps worth finishing"
        description="Organizations with missing watchdog or financial data that still receive gifts or look legacy-eligible."
        organizations={data.researchGaps}
        emptyMessage="No notable research gaps in funded organizations."
      />
    </Box>
  )
}
