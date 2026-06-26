import type {
  LegacyMissionArea,
  LegacyTier,
  MissionBucket,
  RankingStatus,
  Recommendation,
  SourceReliability,
  SourceType,
  SuggestedDonationLevel,
} from "../types/organization.js"

export const STEWARDSHIP_WEIGHTS = {
  financialEfficiency: 35,
  accountability: 35,
  governance: 20,
  missionFit: 10,
} as const

export const RANKING_MODEL_VERSION = "stewardship-v1" as const

export const RANKING_LIST_GENERAL_SUBCATEGORY = "General"

export const RECOMMENDATION_THRESHOLDS = {
  priorityFundScoreMin: 78,
  keepScoreMin: 68,
  reviewScoreMin: 55,
  reduceScoreMin: 40,
  highConfidenceMin: 90,
  partiallyVerifiedMin: 50,
  verifiedMin: 85,
  legacyMin: 78,
  priorityFundConfidenceMin: 90,
  keepConfidenceMin: 80,
  accountabilityMinForKeep: 65,
  accountabilityMinForReduce: 45,
  stewardshipMinForReduce: 45,
  reviewConfidenceMax: 60,
  keepSmallConfidenceMax: 84,
} as const

export const RANKING_VERIFICATION = {
  verifiedConfidenceMin: 85,
} as const

export const CONFIDENCE_BAND_THRESHOLDS = {
  high: 90,
  medium: 70,
} as const

export const SCORE_BAND_THRESHOLDS = {
  exceptional: 78,
  strong: 68,
  adequate: 55,
} as const

export const GIVING_PLAN_LIMITS = {
  maxTopRecommendedPerBucket: 4,
} as const

export const PERSONALIZED_RANKING_RULES = {
  maxDonorConfidenceBoost: 3,
  halfBoostWhenUnverified: true,
} as const

export const SUGGESTED_DONATION_LEVEL_BY_RECOMMENDATION: Record<Recommendation, SuggestedDonationLevel> = {
  "Priority Fund": "Core Annual Gift",
  Keep: "Small Recurring Gift",
  "Keep Small Until Research Complete": "Small Recurring Gift",
  Reduce: "One-Time Small Gift",
  "Small Test Donation": "One-Time Small Gift",
  "Review Before Donating": "Research First",
  "Pause / Do Not Fund": "Do Not Continue",
}

export const LEGACY_RULES = {
  confidenceMin: 90,
  accountabilityMin: 70,
  financialEfficiencyMin: 60,
  politicalRiskMin: 60,
  impactMin: 65,
  legacyCoreScoreMin: 82,
  legacyCoreConfidenceMin: 92,
  stewardshipScoreMin: 78,
  requiresBasicImpactEvidence: true,
} as const

export const MISSION_FIT_DEFAULT_SCORE = 70 as const

export const LEGACY_TIERS: LegacyTier[] = [
  "Legacy Core",
  "Legacy Backup",
  "Not Legacy Eligible",
  "Needs Legal/Financial Review",
]

export const MISSION_BUCKETS: MissionBucket[] = [
  "Farm Animal Welfare",
  "Animal Rescue / Shelters",
  "Wildlife / Conservation",
  "Animal Legal Advocacy",
  "Veterinary / Medical Animal Care",
  "Alzheimer’s / Disease / Health",
  "Other",
]

export const LEGACY_MISSION_AREAS: LegacyMissionArea[] = [
  "Farm Animal Welfare",
  "Animal Rescue / Shelters",
  "Wildlife / Conservation",
  "Animal Legal Advocacy",
  "Alzheimer’s / Disease / Health",
  "Flexible Emergency / Local Small Orgs",
]

export const DEFAULT_LEGACY_MISSION_ALLOCATION: Record<LegacyMissionArea, number> = {
  "Farm Animal Welfare": 35,
  "Animal Rescue / Shelters": 20,
  "Wildlife / Conservation": 20,
  "Animal Legal Advocacy": 10,
  "Alzheimer’s / Disease / Health": 10,
  "Flexible Emergency / Local Small Orgs": 5,
}

export const RANKING_STATUSES: RankingStatus[] = [
  "Not Researched",
  "Preliminary",
  "Research Partial",
  "Research Complete",
  "Do Not Fund / Red Flag",
]

export const SOURCE_TYPE_KEYWORDS: Record<SourceType, string[]> = {
  IRS: ["irs"],
  "ProPublica/Form 990": ["propublica", "form 990", "990"],
  "Charity Navigator": ["charity navigator"],
  "Candid/GuideStar": ["candid", "guidestar"],
  "Cause IQ": ["cause iq"],
  CharityWatch: ["charitywatch"],
  "BBB Wise Giving Alliance": ["bbb", "wise giving"],
  "Animal Charity Evaluators": ["animal charity evaluators", "ace"],
  "Organization website": ["official website", "organization website", "website"],
  "Manual entry": ["manual"],
  Unknown: [],
}

export const SOURCE_RELIABILITY_BY_TYPE: Record<SourceType, SourceReliability> = {
  IRS: "high",
  "ProPublica/Form 990": "high",
  "Charity Navigator": "high",
  "Candid/GuideStar": "high",
  "Cause IQ": "high",
  CharityWatch: "medium",
  "BBB Wise Giving Alliance": "medium",
  "Animal Charity Evaluators": "medium",
  "Organization website": "medium",
  "Manual entry": "high",
  Unknown: "unknown",
}

export const TRIAGE_RESEARCH_CHECKLIST = [
  "Find EIN",
  "Verify 501(c)(3)",
  "Find Form 990",
  "Find program/fundraising/admin percentages",
  "Check Charity Navigator",
  "Check Candid/GuideStar",
  "Check Cause IQ profile",
  "Check ProPublica",
  "Check CharityWatch/BBB if available",
  "Check annual report or impact report",
  "Check political/lobbying/advocacy involvement",
  "Check red flags/scandals",
] as const
