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

function getCategoryTypeLabel(category: ScoreCategoryExplanation): string | null {
  if (category.categoryType === "gate") return "Verification gate"
  if (category.categoryType === "badge") return "Not part of stewardship score"
  if (category.categoryType === "flag") return "Review flag"
  if (category.categoryType === "stewardship" || (category.weightPercent ?? 0) > 0) {
    return `Weight: ${category.weightPercent}% of stewardship`
  }
  return null
}

export function ScoreExplanationCard({ category }: ScoreExplanationCardProps) {
  const categoryType = category.categoryType ?? (category.weightPercent > 0 ? "stewardship" : "badge")
  const maxPoints = resolveCategoryMaxPoints(category)
  const showProgress = categoryType === "stewardship" && category.score !== null
  const progressValue = showProgress ? (category.score! / maxPoints) * 100 : 0
  const typeLabel = getCategoryTypeLabel({ ...category, categoryType })

  return (
    <ScoreExplanationCardRoot>
      <Box sx={{ alignItems: "flex-start", display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "space-between" }}>
        <Typography variant="h6">{category.title}</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Chip size="small" label={category.level} color={getScoreLevelColor(category.level)} />
          {typeLabel ? <Chip size="small" variant="outlined" label={typeLabel} /> : null}
        </Box>
      </Box>

      <Typography color="text.secondary" sx={{ mt: 1 }}>
        {category.whatItMeasures}
      </Typography>

      {categoryType === "stewardship" && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="body2">Component score</Typography>
            <Typography variant="body2">{formatCategoryScoreDisplay(category)}</Typography>
          </Box>
          {showProgress ? (
            <LinearProgress
              variant="determinate"
              value={progressValue}
              color={getProgressColor(category.level)}
              sx={{ height: 8, borderRadius: 999 }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Excluded from stewardship total — see financial completeness note.
            </Typography>
          )}
        </Box>
      )}

      {categoryType === "badge" && category.score !== null && (
        <Typography variant="body2" sx={{ mt: 2 }}>
          Reference subscore: {formatCategoryScoreDisplay(category)} (informational only)
        </Typography>
      )}

      <Typography sx={{ mt: 2, fontWeight: 600 }}>Why this rating</Typography>
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
