import type { ChipProps } from "@mui/material"
import type { ScoreCategoryExplanation, ScoreLevel } from "../../types/organization"
import { getCategoryMaxPoints } from "../../config/ranking-rubric-config"

export function getScoreLevelColor(level: ScoreLevel): ChipProps["color"] {
  if (level === "Strong") return "success"
  if (level === "Good") return "success"
  if (level === "Moderate") return "warning"
  if (level === "Low") return "error"
  return "default"
}

export function resolveCategoryMaxPoints(category: Pick<ScoreCategoryExplanation, "key" | "maxPoints">): number {
  if (typeof category.maxPoints === "number" && category.maxPoints > 0) {
    return category.maxPoints
  }
  return getCategoryMaxPoints(category.key)
}

export function formatScoreDisplay(score: number | null, maxPoints: number): string {
  if (score === null) return "Not available yet"
  return `${score} / ${maxPoints}`
}

export function formatCategoryScoreDisplay(category: Pick<ScoreCategoryExplanation, "key" | "score" | "maxPoints">): string {
  return formatScoreDisplay(category.score, resolveCategoryMaxPoints(category))
}
