import { Box, Button, CircularProgress, Typography } from "@mui/material"
import { Link, useParams } from "react-router-dom"
import { useOrganizationQuery } from "../hooks/use-organization-query"
import {
  formatAdvocacyReviewLabel,
  formatFinancialCompletenessLabel,
  formatImpactEvidenceLevelShort,
  formatLegalVerificationLabel,
  formatResearchStatusLabel,
  formatStewardshipScoreDisplay,
  isStewardshipRenormalized,
  shouldShowAdvocacyReviewChip,
} from "../utils/ranking-display-labels"
import "../styles/print.css"

export function OrganizationPrintPage() {
  const { id = "" } = useParams()
  const { data, isLoading, isError } = useOrganizationQuery(id)

  if (isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography>Preparing printable summary...</Typography>
      </Box>
    )
  }

  if (isError || !data?.organization) {
    return <Typography>Could not load organization summary.</Typography>
  }

  const organization = data.organization
  const explanation = organization.scoreBreakdown.rankingExplanation
  const generatedAt = new Date().toLocaleString()
  const stewardshipScore =
    organization.objectiveStewardshipScore ?? organization.stewardshipScore
  const renormalized = isStewardshipRenormalized(organization.financialCompletenessStatus)

  return (
    <Box className="print-page">
      <Box className="print-toolbar no-print">
        <Button component={Link} to={`/organizations/${organization.id}`} variant="outlined">
          Back to details
        </Button>
        <Button variant="contained" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </Box>

      <header className="print-header">
        <Typography className="print-title" variant="h4">
          {organization.organizationName}
        </Typography>
        <Typography color="text.secondary">
          {organization.rankingListLabel} • Generated {generatedAt}
        </Typography>
        {organization.website && (
          <Typography sx={{ mt: 0.5 }}>
            Website: {organization.website}
          </Typography>
        )}
      </header>

      <section className="print-section print-decision-box">
        <Typography variant="h6">Giving decision</Typography>
        <Typography sx={{ fontSize: "1.35rem", fontWeight: 700, mt: 1 }}>{organization.recommendation}</Typography>
        <Typography sx={{ mt: 1 }}>
          Research: {formatResearchStatusLabel(organization.rankingStatus)} • Confidence: {organization.confidenceBand} ({organization.confidenceScore}%)
        </Typography>
        <Typography sx={{ mt: 1 }}>
          {formatStewardshipScoreDisplay(stewardshipScore, organization.scoreBand, renormalized)}
        </Typography>
        <Typography sx={{ mt: 1 }}>
          {formatLegalVerificationLabel(organization.legalVerificationStatus)} • {formatImpactEvidenceLevelShort(organization.impactEvidenceLevel)} • {formatFinancialCompletenessLabel(organization.financialCompletenessStatus)}
        </Typography>
        <Typography sx={{ mt: 1 }}>
          {new Date().getFullYear()} annual gift: ${organization.approximateAnnualDonation.toLocaleString()}
        </Typography>
        {organization.legacyEligible ? (
          <Typography sx={{ mt: 1 }}>Legacy: {organization.legacyTier}</Typography>
        ) : organization.legacyExclusionReason ? (
          <Typography sx={{ mt: 1 }}>Legacy exclusion: {organization.legacyExclusionReason}</Typography>
        ) : null}
      </section>

      {explanation && (
        <section className="print-section">
          <Typography variant="h6">Bottom line</Typography>
          <Typography sx={{ mt: 1 }}>{explanation.bottomLine}</Typography>
          <Typography sx={{ mt: 1 }}>{explanation.recommendationExplanation}</Typography>
        </section>
      )}

      <section className="print-section">
        <Typography variant="h6">Evidence snapshot</Typography>
        <Box className="print-grid" sx={{ mt: 1 }}>
          <Typography>Legal: {organization.legalVerificationStatus}</Typography>
          <Typography>Financials: {formatFinancialCompletenessLabel(organization.financialCompletenessStatus)}</Typography>
          <Typography>Impact level: {organization.impactEvidenceLevel}</Typography>
          {organization.watchdogReviewRequired && <Typography>Watchdog review recommended</Typography>}
          {shouldShowAdvocacyReviewChip(organization.advocacyReviewStatus) && (
            <Typography>{formatAdvocacyReviewLabel(organization.advocacyReviewStatus)}</Typography>
          )}
          <Typography>Governance hygiene: {organization.governanceScore}/100</Typography>
          <Typography>Accountability: {organization.accountabilityScore}/100</Typography>
          <Typography>Mission fit: {organization.missionFitScore}/100</Typography>
          <Typography>
            Financial efficiency:{" "}
            {organization.financialEfficiencyScore !== null ? `${organization.financialEfficiencyScore}/100` : "Excluded (renormalized)"}
          </Typography>
        </Box>
      </section>

      {(organization.duplicateMissionGroup || organization.duplicateMission === "Y") && (
        <section className="print-section">
          <Typography variant="h6">Mission overlap tags</Typography>
          <Typography sx={{ mt: 1 }}>Overlapping mission: {organization.duplicateMission || "Not set"}</Typography>
          <Typography>Group: {organization.duplicateMissionGroup || "Not set"}</Typography>
          <Typography>Role: {organization.duplicateMissionRole || "Not set"}</Typography>
        </section>
      )}

      {organization.redFlags.length > 0 && (
        <section className="print-section">
          <Typography variant="h6">Red flags</Typography>
          <ul>
            {organization.redFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="print-section">
        <Typography variant="h6">Gift size review</Typography>
        <Typography sx={{ mt: 1 }}>{organization.donationAmountAssessment}</Typography>
        <Typography sx={{ mt: 1 }}>Next step: {organization.strongestNextResearchStep}</Typography>
      </section>
    </Box>
  )
}
