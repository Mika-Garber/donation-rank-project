import { Box, Chip, LinearProgress, Typography } from "@mui/material"
import type { ScoreCategoryExplanation } from "../../types/organization"
import { formatCategoryScoreDisplay, getScoreLevelColor, resolveCategoryMaxPoints } from "./score-explanation-helpers"
import { ScoreExplanationCardRoot } from "./score-explanation-card.styled"

interface ScoreExplanationCardProps {
  category: ScoreCategoryExplanation
}

function getProgressColor(level: ScoreCategoryExplanation["level"]): "success" | "warning" | "error" | "inherit" {
  if (level === "Strong" || level === "Good") return "success"
  if (level === "Moderate") return "warning"
  if (level === "Low") return "error"
  return "inherit"
}

export function ScoreExplanationCard({ category }: ScoreExplanationCardProps) {
  const maxPoints = resolveCategoryMaxPoints(category)
  const progressValue = category.score === null ? 0 : (category.score / maxPoints) * 100

  return (
    <ScoreExplanationCardRoot>
      <Box sx={{ alignItems: "flex-start", display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "space-between" }}>
        <Typography variant="h6">{category.title}</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Chip size="small" label={category.level} color={getScoreLevelColor(category.level)} />
          <Chip size="small" variant="outlined" label={`Weight: ${category.weightPercent}%`} />
        </Box>
      </Box>

      <Typography color="text.secondary" sx={{ mt: 1 }}>
        {category.whatItMeasures}
      </Typography>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="body2">Score</Typography>
          <Typography variant="body2">{formatCategoryScoreDisplay(category)}</Typography>
        </Box>
        <LinearProgress
          variant={category.score === null ? "indeterminate" : "determinate"}
          value={progressValue}
          color={getProgressColor(category.level)}
          sx={{ height: 8, borderRadius: 999 }}
        />
      </Box>

      <Typography sx={{ mt: 2, fontWeight: 600 }}>Why this score</Typography>
      <Typography sx={{ mt: 0.5 }}>{category.whyThisScore}</Typography>

      {category.details.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: 1.5 }}>
          {category.details.map((detail) => (
            <Typography key={detail} variant="body2">
              • {detail}
            </Typography>
          ))}
        </Box>
      )}
    </ScoreExplanationCardRoot>
  )
}
