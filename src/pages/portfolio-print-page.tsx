import { Box, Button, CircularProgress, Typography } from "@mui/material"
import { Link } from "react-router-dom"
import { usePortfolioReviewQuery } from "../hooks/use-portfolio-review-query"
import "../styles/print.css"

export function PortfolioPrintPage() {
  const { data, isLoading, isError } = usePortfolioReviewQuery()

  if (isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography>Preparing printable portfolio summary...</Typography>
      </Box>
    )
  }

  if (isError || !data) {
    return <Typography>Could not load portfolio summary.</Typography>
  }

  const generatedAt = new Date().toLocaleString()

  return (
    <Box className="print-page">
      <Box className="print-toolbar no-print">
        <Button component={Link} to="/portfolio-review" variant="outlined">
          Back to Portfolio Review
        </Button>
        <Button variant="contained" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </Box>

      <header className="print-header">
        <Typography className="print-title" variant="h4">
          Donation Portfolio Summary
        </Typography>
        <Typography color="text.secondary">Generated {generatedAt}</Typography>
      </header>

      <section className="print-section">
        <Typography variant="h6">Consolidation snapshot</Typography>
        <Typography sx={{ mt: 1 }}>{data.consolidation.headline}</Typography>
        <Typography sx={{ mt: 1 }}>{data.consolidation.guidance}</Typography>
        <Box className="print-grid" sx={{ mt: 2 }}>
          <Typography>Organizations: {data.consolidation.totalOrganizations}</Typography>
          <Typography>Annual giving: ${data.consolidation.totalAnnualGiving.toLocaleString()}</Typography>
          <Typography>
            Keep / Priority Fund: {data.consolidation.continueRecommendationCount}
          </Typography>
          <Typography>Legacy eligible: {data.consolidation.legacyEligibleCount}</Typography>
          <Typography>
            Suggested focus: {data.consolidation.suggestedFocusMin}–{data.consolidation.suggestedFocusMax}
          </Typography>
        </Box>
      </section>

      <section className="print-section">
        <Typography variant="h6">Top 20 by annual gift</Typography>
        <table className="print-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Gift</th>
              <th>Stewardship</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {data.topByAnnualGift.map((organization) => (
              <tr key={organization.id}>
                <td>{organization.organizationName}</td>
                <td>${organization.approximateAnnualDonation.toLocaleString()}</td>
                <td>
                  {organization.stewardshipScoreLabel} ({organization.confidenceBand})
                </td>
                <td>{organization.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.highGiftOutliers.length > 0 && (
        <section className="print-section">
          <Typography variant="h6">High-gift review flags</Typography>
          <table className="print-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Gift</th>
                <th>Recommendation</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {data.highGiftOutliers.map((organization) => (
                <tr key={organization.id}>
                  <td>{organization.organizationName}</td>
                  <td>${organization.approximateAnnualDonation.toLocaleString()}</td>
                  <td>{organization.recommendation}</td>
                  <td>{organization.reviewFlag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {data.missionOverlapGroups.length > 0 && (
        <section className="print-section">
          <Typography variant="h6">Mission overlap groups</Typography>
          {data.missionOverlapGroups.map((group) => (
            <Box key={group.groupId} sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 600 }}>
                {group.groupLabel} ({group.organizationCount} orgs, ${group.totalAnnualGiving.toLocaleString()}/yr)
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {group.consolidationNote}
              </Typography>
              <ul>
                {group.organizations.map((organization) => (
                  <li key={organization.id}>
                    {organization.organizationName} — ${organization.approximateAnnualDonation.toLocaleString()} —{" "}
                    {organization.duplicateMissionRole || "role not set"} — {organization.recommendation}
                  </li>
                ))}
              </ul>
            </Box>
          ))}
        </section>
      )}

      <section className="print-section">
        <Typography variant="h6">Suggested core candidates</Typography>
        <ul>
          {data.suggestedCoreCandidates.map((organization) => (
            <li key={organization.id}>
              {organization.organizationName} — ${organization.approximateAnnualDonation.toLocaleString()} — stewardship{" "}
              {organization.stewardshipScoreLabel}
            </li>
          ))}
        </ul>
      </section>
    </Box>
  )
}
