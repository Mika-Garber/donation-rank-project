import { Alert, Box, Chip, CircularProgress, Divider, Paper, Typography } from "@mui/material"
import { useQuery } from "@tanstack/react-query"
import { getRankingExplanation } from "../services/api-client"

const SCORE_AREA_EXPLANATIONS = [
  {
    key: "governance" as const,
    title: "Verified legal status and identity",
    explanation: "EIN, 501(c)(3), tax-deductible status, and payee identity. Acts as a safety gate before donating.",
  },
  {
    key: "accountability" as const,
    title: "Accountability and transparency",
    explanation: "Recent filings, public financials, leadership, reports, and watchdog ratings (CN, CW, BBB, Candid).",
  },
  {
    key: "impactEvidence" as const,
    title: "Impact evidence",
    explanation: "Documented outcomes — not mission alone. For animal charities: rescues, adoptions, policy wins, measurable progress.",
  },
  {
    key: "financialEfficiency" as const,
    title: "Financial efficiency",
    explanation: "Program, fundraising, and admin ratios from verified Form 990 or watchdog data. Missing ratios stay null.",
  },
  {
    key: "politicalRisk" as const,
    title: "Political and advocacy alignment",
    explanation: "Lobbying, advocacy, and policy work — flagged for review, not automatically penalized for legal-advocacy orgs.",
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
          Charities are grouped into mission-bucket lists and ranked against similar organizations. An all-organizations view is also available.
        </Typography>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          What each part of the score means
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Each charity earns points in five categories (10 + 25 + 30 + 30 + 5 = 100 max). The percentage shows how much each category counts toward the final score.
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SCORE_AREA_EXPLANATIONS.map((area, index) => (
            <Box key={area.key}>
              <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontWeight: 600 }}>{area.title}</Typography>
                <Chip label={`${data.weights[area.key]}% of score`} size="small" variant="outlined" />
              </Box>
              <Typography color="text.secondary">{area.explanation}</Typography>
              {index < SCORE_AREA_EXPLANATIONS.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          ))}
        </Box>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6">How decisions are made</Typography>
        <Typography sx={{ mt: 1 }}>{data.scoreRule}</Typography>
        {data.categoryListRule ? <Typography sx={{ mt: 1 }}>{data.categoryListRule}</Typography> : null}
        <Typography sx={{ mt: 1 }}>{data.confidenceRule}</Typography>
        <Typography sx={{ mt: 1 }}>{data.rankingStatusRule}</Typography>
        <Typography sx={{ mt: 1 }}>{data.preliminaryVsVerifiedRule}</Typography>
        {data.personalizedRankRule ? <Typography sx={{ mt: 1 }}>{data.personalizedRankRule}</Typography> : null}
        <Typography sx={{ mt: 1 }}>
          List rank compares similar charities within the same mission bucket and subcategory. Global rank compares every organization together.
        </Typography>
        <Typography sx={{ mt: 1 }}>
          Objective rank is the pure evidence-based order. Personalized rank keeps that foundation, then applies a small capped donor-confidence
          adjustment based on prior annual giving history.
        </Typography>
        <Typography sx={{ mt: 1 }}>{data.donationAssessmentRule}</Typography>
        <Typography sx={{ mt: 1 }}>{data.legacyRule}</Typography>
        <Typography sx={{ mt: 1 }}>
          Financial efficiency is assessed using program, fundraising, and admin percentages. If those are missing, the score stays preliminary.
        </Typography>
        <Typography sx={{ mt: 1 }}>
          Missing data means review first. It does not automatically mean an organization is bad.
        </Typography>
      </Paper>
    </Box>
  )
}
