import { Alert, Box, Chip, CircularProgress, Divider, Paper, Typography } from "@mui/material"
import { useQuery } from "@tanstack/react-query"
import { getRankingExplanation } from "../services/api-client"

const STEWARDSHIP_COMPONENTS = [
  {
    key: "financialEfficiency" as const,
    title: "Financial health & efficiency",
    explanation: "Program, fundraising, and admin ratios from verified Form 990 or watchdog data. Included only when all three ratios are verified.",
  },
  {
    key: "accountability" as const,
    title: "Accountability & transparency",
    explanation: "Recent filings, public financials, leadership, reports, and watchdog ratings. Poor CN or CW grades trigger review rather than positive coverage.",
  },
  {
    key: "governance" as const,
    title: "Governance hygiene",
    explanation: "IRS filing sources, recent research, and public presence. EIN and 501(c)(3) checks are under legal verification, not this component.",
  },
  {
    key: "missionFit" as const,
    title: "Mission fit within list",
    explanation: "How clearly the organization fits its mission bucket and your overlap tags (primary, secondary, phasing-out).",
  },
]

export function HowRankingWorksPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ranking-explanation"],
    queryFn: getRankingExplanation,
  })

  if (isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography>Loading ranking explanation...</Typography>
      </Box>
    )
  }

  if (isError || !data) {
    return <Alert severity="error">Could not load ranking explanation.</Alert>
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          How this ranking system works
        </Typography>
        <Typography color="text.secondary">
          Charities are grouped into mission-bucket lists and ranked by stewardship score within each list. Stewardship
          uses mostly comparable financial and accountability data. Impact evidence is shown separately because
          documentation quality varies widely.
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Model: {data.modelVersion}
        </Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Legal verification gate
        </Typography>
        <Typography color="text.secondary">{data.legalVerificationRule}</Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Stewardship score components
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {data.stewardshipScoreRule}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {STEWARDSHIP_COMPONENTS.map((area, index) => (
            <Box key={area.key}>
              <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontWeight: 600 }}>{area.title}</Typography>
                <Chip
                  label={`${data.stewardshipWeights[area.key]}% of stewardship`}
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Typography color="text.secondary">{area.explanation}</Typography>
              {index < STEWARDSHIP_COMPONENTS.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          ))}
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Financial completeness & renormalization
        </Typography>
        <Typography color="text.secondary">{data.financialCompletenessRule}</Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Impact evidence level (separate)
        </Typography>
        <Typography color="text.secondary">{data.impactEvidenceRule}</Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Review flags
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          {data.watchdogReviewRule}
        </Typography>
        <Typography color="text.secondary">{data.politicalReviewRule}</Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6">How decisions are made</Typography>
        <Typography sx={{ mt: 1 }}>{data.recommendationRule}</Typography>
        {data.categoryListRule ? <Typography sx={{ mt: 1 }}>{data.categoryListRule}</Typography> : null}
        <Typography sx={{ mt: 1 }}>{data.confidenceRule}</Typography>
        <Typography sx={{ mt: 1 }}>{data.rankingStatusRule}</Typography>
        <Typography sx={{ mt: 1 }}>{data.personalizedRankRule}</Typography>
        <Typography sx={{ mt: 1 }}>
          List rank compares similar charities within the same mission bucket. Global rank compares every organization
          together — use list rank for fair comparison.
        </Typography>
        <Typography sx={{ mt: 1 }}>{data.donationAssessmentRule}</Typography>
        <Typography sx={{ mt: 1 }}>{data.legacyRule}</Typography>
        <Typography sx={{ mt: 1 }}>
          Missing data means review first. It does not automatically mean an organization is bad.
        </Typography>
      </Paper>
    </Box>
  )
}
