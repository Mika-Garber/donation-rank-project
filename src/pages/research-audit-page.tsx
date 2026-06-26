import { Alert, Box, CircularProgress, Paper, Typography } from "@mui/material"
import { useResearchAuditQuery } from "../hooks/use-research-audit-query"
import { formatResearchStatusLabel } from "../utils/ranking-display-labels"
import type { RankingStatus } from "../types/organization"

export function ResearchAuditPage() {
  const { data, isLoading, isError } = useResearchAuditQuery()

  if (isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography>Loading research audit...</Typography>
      </Box>
    )
  }

  if (isError || !data) {
    return <Alert severity="error">Could not load research audit.</Alert>
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Research Audit
        </Typography>
        <Typography color="text.secondary">
          This page checks research coverage and whether stewardship scores are spread enough to compare organizations.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Research coverage
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography>Organizations: {data.stats.totalOrganizations}</Typography>
          <Typography>Verified EIN: {data.stats.verifiedEinCount}</Typography>
          <Typography>Verified 501(c)(3): {data.stats.verified501c3Count}</Typography>
          <Typography>Financial ratios complete: {data.stats.financialRatiosCount}</Typography>
          <Typography>Charity Navigator ratings: {data.stats.charityNavigatorCount}</Typography>
          <Typography>CharityWatch grades: {data.stats.charityWatchCount}</Typography>
          <Typography>ACE recommendations matched: {data.stats.aceRecommendationCount}</Typography>
          <Typography>Candid/GuideStar data: {data.stats.candidGuideStarCount}</Typography>
          <Typography>ProPublica/Form 990 data: {data.stats.proPublicaForm990Count}</Typography>
          <Typography>Political notes available: {data.stats.politicalNotesCount}</Typography>
          <Typography>Impact evidence notes available: {data.stats.impactEvidenceNotesCount}</Typography>
          <Typography>Research complete: {data.stats.verifiedRankingCount}</Typography>
          <Typography>Preliminary: {data.stats.preliminaryCount}</Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Ranking status distribution
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {Object.entries(data.rankingStatusCounts).map(([status, count]) => (
            <Typography key={status}>
              {formatResearchStatusLabel(status as RankingStatus)}: {count}
            </Typography>
          ))}
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Score spread check
        </Typography>
        <Typography>
          Cluster range: {data.spreadCheck.lowerBound}-{data.spreadCheck.upperBound}
        </Typography>
        <Typography>
          Clustered organizations: {data.spreadCheck.clusteredCount} ({data.spreadCheck.clusteredPercent}%)
        </Typography>
        <Typography sx={{ mt: 1 }}>{data.message}</Typography>
        {data.spreadCheck.warning && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {data.spreadCheck.warning}
          </Alert>
        )}
      </Paper>
    </Box>
  )
}
