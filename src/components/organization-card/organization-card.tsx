import { Box, Button, CardActions, CardContent, Chip, Tooltip, Typography } from "@mui/material"
import { Link } from "react-router-dom"
import type { Organization } from "../../types/organization"
import type { RankViewMode } from "../../store/use-ui-store"
import {
  formatAdvocacyReviewLabel,
  formatFinancialCompletenessLabel,
  formatImpactEvidenceLevelShort,
  formatLegalVerificationLabel,
  formatResearchStatusLabel,
  formatStewardshipScoreDisplay,
  getAdvocacyReviewChipColor,
  isStewardshipRenormalized,
  shouldShowAdvocacyReviewChip,
} from "../../utils/ranking-display-labels"
import { OrganizationCardRoot } from "./organization-card.styled"

interface OrganizationCardProps {
  organization: Organization
  rankViewMode: RankViewMode
  showGlobalRanks: boolean
  highlighted?: boolean
}

function getRecommendationColor(recommendation: Organization["recommendation"]): "default" | "success" | "warning" | "error" {
  if (recommendation === "Priority Fund" || recommendation === "Keep") return "success"
  if (recommendation === "Pause / Do Not Fund") return "error"
  if (recommendation === "Reduce" || recommendation === "Review Before Donating") return "warning"
  return "default"
}

function getLegalVerificationColor(status: Organization["legalVerificationStatus"]): "default" | "success" | "warning" | "error" {
  if (status === "Verified") return "success"
  if (status === "Needs Review") return "warning"
  if (status === "Failed Verification") return "error"
  return "default"
}

export function OrganizationCard({ organization, rankViewMode, showGlobalRanks, highlighted = false }: OrganizationCardProps) {
  const explanation = organization.scoreBreakdown?.rankingExplanation
  const summaryLine = explanation?.overallSummary ?? organization.suggestedDonationAction
  const listRank = rankViewMode === "objective" ? organization.listObjectiveRank : organization.listPersonalizedRank
  const globalRank = rankViewMode === "objective" ? organization.globalObjectiveRank : organization.globalPersonalizedRank
  const stewardshipScore = organization.objectiveStewardshipScore ?? organization.stewardshipScore
  const renormalized = isStewardshipRenormalized(organization.financialCompletenessStatus)
  const stewardshipLabel = formatStewardshipScoreDisplay(stewardshipScore, organization.scoreBand, renormalized)

  return (
    <OrganizationCardRoot id={`organization-card-${organization.id}`} highlighted={highlighted}>
      <CardContent>
        <Box sx={{ alignItems: "flex-start", display: "flex", gap: 2, justifyContent: "space-between" }}>
          <Typography variant="h6">{organization.organizationName}</Typography>
          <Chip label={organization.recommendation} color={getRecommendationColor(organization.recommendation)} />
        </Box>
        <Typography color="text.secondary">{organization.rankingListLabel}</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
          <Tooltip
            title={
              renormalized
                ? "Financial component excluded — remaining stewardship categories were renormalized."
                : "Stewardship score based on comparable financial and accountability data."
            }
          >
            <Chip size="small" label={stewardshipLabel} variant="outlined" />
          </Tooltip>
          <Chip size="small" label={formatResearchStatusLabel(organization.rankingStatus)} variant="outlined" />
          <Chip
            size="small"
            label={formatLegalVerificationLabel(organization.legalVerificationStatus)}
            variant="outlined"
            color={getLegalVerificationColor(organization.legalVerificationStatus)}
          />
          <Chip size="small" label={formatImpactEvidenceLevelShort(organization.impactEvidenceLevel)} variant="outlined" />
          <Chip size="small" label={`Confidence: ${organization.confidenceBand} (${organization.confidenceScore}%)`} variant="outlined" />
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
          {organization.financialCompletenessStatus !== "complete" && (
            <Chip size="small" label={formatFinancialCompletenessLabel(organization.financialCompletenessStatus)} color="warning" variant="outlined" />
          )}
          {organization.watchdogReviewRequired && (
            <Chip size="small" label="Watchdog review" color="warning" variant="outlined" />
          )}
          {shouldShowAdvocacyReviewChip(organization.advocacyReviewStatus) && (
            <Chip
              size="small"
              label={formatAdvocacyReviewLabel(organization.advocacyReviewStatus)}
              color={getAdvocacyReviewChipColor(organization.advocacyReviewStatus)}
              variant="outlined"
            />
          )}
        </Box>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {summaryLine}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {showGlobalRanks ? (
            <>
              Global rank #{globalRank} ({rankViewMode}) • List #{listRank} of {organization.rankingListSize}
            </>
          ) : (
            <>
              List rank #{listRank} ({rankViewMode}) of {organization.rankingListSize} • Global #{globalRank}
            </>
          )}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
          <Chip size="small" label={`Annual gift: $${organization.approximateAnnualDonation.toFixed(0)}`} />
          {organization.legacyEligible && <Chip size="small" label={organization.legacyTier} color="success" />}
          {rankViewMode === "personalized" && organization.donorConfidenceAdjustment > 0 && (
            <Chip size="small" label={`Donor boost: +${organization.donorConfidenceAdjustment}`} />
          )}
        </Box>
      </CardContent>
      <CardActions>
        <Button component={Link} to={`/organizations/${organization.id}`} variant="contained" size="small">
          See full explanation
        </Button>
      </CardActions>
    </OrganizationCardRoot>
  )
}
