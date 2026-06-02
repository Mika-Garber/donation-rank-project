import { Box, Button, CardActions, CardContent, Chip, Typography } from "@mui/material"
import { Link } from "react-router-dom"
import type { Organization } from "../../types/organization"
import type { RankViewMode } from "../../store/use-ui-store"
import { OrganizationCardRoot } from "./organization-card.styled"

interface OrganizationCardProps {
  organization: Organization
  rankViewMode: RankViewMode
  showGlobalRanks: boolean
}

function getRecommendationColor(recommendation: Organization["recommendation"]): "default" | "success" | "warning" | "error" {
  if (recommendation === "Priority Fund" || recommendation === "Keep") return "success"
  if (recommendation === "Pause / Do Not Fund") return "error"
  if (recommendation === "Reduce" || recommendation === "Review Before Donating") return "warning"
  return "default"
}

export function OrganizationCard({ organization, rankViewMode, showGlobalRanks }: OrganizationCardProps) {
  const explanation = organization.scoreBreakdown.rankingExplanation
  const summaryLine = explanation?.overallSummary ?? organization.suggestedDonationAction
  const listRank = rankViewMode === "objective" ? organization.listObjectiveRank : organization.listPersonalizedRank
  const globalRank = rankViewMode === "objective" ? organization.globalObjectiveRank : organization.globalPersonalizedRank

  return (
    <OrganizationCardRoot>
      <CardContent>
        <Box sx={{ alignItems: "flex-start", display: "flex", gap: 2, justifyContent: "space-between" }}>
          <Typography variant="h6">{organization.organizationName}</Typography>
          <Chip label={organization.recommendation} color={getRecommendationColor(organization.recommendation)} />
        </Box>
        <Typography color="text.secondary">{organization.rankingListLabel}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {showGlobalRanks ? (
            <>
              Global rank #{globalRank} {rankViewMode} • Score {organization.objectiveDonationWorthinessScore}/100
            </>
          ) : (
            <>
              List rank #{listRank} {rankViewMode} of {organization.rankingListSize} • Global #{globalRank} • Score{" "}
              {organization.objectiveDonationWorthinessScore}/100
            </>
          )}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {summaryLine}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
          <Chip size="small" label={`Annual: $${organization.approximateAnnualDonation.toFixed(0)}`} />
          <Chip size="small" label={organization.rankingStatus} />
          {organization.donorConfidenceAdjustment > 0 && (
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
