import { RANKING_LIST_GENERAL_SUBCATEGORY } from "../config/ranking-config.js"
import type { MissionBucket } from "../types/organization.js"

export function getMissionBucket(category: string, subcategory: string): MissionBucket {
  const categoryText = category.trim().toLowerCase()
  const subcategoryText = subcategory.trim().toLowerCase()
  const combined = `${categoryText} ${subcategoryText}`
  if (combined.includes("farm")) return "Farm Animal Welfare"
  if (combined.includes("rescue") || combined.includes("shelter")) return "Animal Rescue / Shelters"
  if (combined.includes("wildlife") || combined.includes("conservation")) return "Wildlife / Conservation"
  if (combined.includes("legal") || combined.includes("advocacy")) return "Animal Legal Advocacy"
  if (combined.includes("vet") || combined.includes("medical")) return "Veterinary / Medical Animal Care"
  if (combined.includes("alzheimer") || combined.includes("disease") || combined.includes("health")) {
    return "Alzheimer’s / Disease / Health"
  }
  if (categoryText.includes("animal")) return "Animal Rescue / Shelters"
  if (categoryText.includes("nature")) return "Wildlife / Conservation"
  return "Other"
}

export function getRankingListSubcategory(subcategory: string): string {
  return subcategory.trim() || RANKING_LIST_GENERAL_SUBCATEGORY
}

export function getRankingListKey(missionBucket: MissionBucket, subcategory: string): string {
  return `${missionBucket}::${getRankingListSubcategory(subcategory)}`
}

export function getRankingListLabel(missionBucket: MissionBucket, subcategory: string): string {
  const normalizedSubcategory = getRankingListSubcategory(subcategory)
  if (normalizedSubcategory === RANKING_LIST_GENERAL_SUBCATEGORY) return missionBucket
  return `${missionBucket} · ${normalizedSubcategory}`
}
