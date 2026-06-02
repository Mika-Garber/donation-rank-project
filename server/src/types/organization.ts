export type ScoreLevel = "Strong" | "Good" | "Moderate" | "Low" | "Unknown"

export interface ScoreCategoryExplanation {
  key: string
  title: string
  score: number | null
  maxPoints: number
  weightPercent: number
  level: ScoreLevel
  whatItMeasures: string
  whyThisScore: string
  details: string[]
}

export interface OrganizationDetailExplanation {
  headline: string
  overallSummary: string
  rankExplanation: string
  personalizedRankExplanation: string
  recommendationTitle: string
  recommendationExplanation: string
  donorHistoryExplanation: string
  bottomLine: string
  strengths: string[]
  concerns: string[]
  categories: ScoreCategoryExplanation[]
  missingDataNote: string | null
}

export interface ScoreBreakdown {
  preliminaryScore: number
  verifiedDonationWorthinessScore: number | null
  objectiveDonationWorthinessScore: number
  personalizedDonationWorthinessScore: number
  donorConfidenceAdjustment: number
  donorConfidenceReason: string
  objectiveRank?: number
  personalizedRank?: number
  globalObjectiveRank?: number
  globalPersonalizedRank?: number
  listObjectiveRank?: number
  listPersonalizedRank?: number
  rankingListSize?: number
  rankShift?: number
  rankShiftReason: string
  donationWorthinessScore: number
  rankingStatus: RankingStatus
  impactEvidenceScore: number
  accountabilityScore: number
  financialEfficiencyScore: number | null
  financialEfficiencyStatus: "known" | "unknown"
  governanceScore: number
  politicalRiskScore: number
  confidenceScore: number
  recommendation: Recommendation
  donationAmountAssessment: string
  suggestedDonationAction: string
  suggestedDonationLevel: SuggestedDonationLevel
  legacyEligible: boolean
  legacyTier: LegacyTier
  legacyRationale: string
  missionBucket: MissionBucket
  rankingListKey: string
  rankingListLabel: string
  compactGivingRole: CompactGivingRole
  politicalInvolvementNotes: string
  impactEvidenceNotes: string
  accountabilityNotes: string
  redFlags: string[]
  nextAction: string
  criticalMissingFields: string[]
  strongestNextResearchStep: string
  reasons: string[]
  missingFields: string[]
  rankingExplanation?: OrganizationDetailExplanation
}

export type Recommendation =
  | "Priority Fund"
  | "Keep"
  | "Keep Small Until Verified"
  | "Reduce"
  | "Small Test Donation"
  | "Review Before Donating"
  | "Pause / Do Not Fund"

export type RankingStatus =
  | "Not Researched"
  | "Preliminary Only"
  | "Partially Verified"
  | "Verified Ranking"
  | "Do Not Fund / Red Flag"

export type SourceType =
  | "IRS"
  | "ProPublica/Form 990"
  | "Charity Navigator"
  | "Candid/GuideStar"
  | "CharityWatch"
  | "BBB Wise Giving Alliance"
  | "Animal Charity Evaluators"
  | "Organization website"
  | "Manual entry"
  | "Unknown"

export type SourceReliability = "high" | "medium" | "low" | "unknown"

export type SuggestedDonationLevel =
  | "Core Annual Gift"
  | "Small Recurring Gift"
  | "One-Time Small Gift"
  | "Research First"
  | "Do Not Continue"

export type LegacyTier =
  | "Legacy Core"
  | "Legacy Backup"
  | "Not Legacy Eligible"
  | "Needs Legal/Financial Review"

export type MissionBucket =
  | "Farm Animal Welfare"
  | "Animal Rescue / Shelters"
  | "Wildlife / Conservation"
  | "Animal Legal Advocacy"
  | "Veterinary / Medical Animal Care"
  | "Alzheimer’s / Disease / Health"
  | "Other"

export type CompactGivingRole =
  | "Core Charity"
  | "Secondary Charity"
  | "Small Local Support"
  | "Watchlist"
  | "Pause"

export type LegacyMissionArea =
  | "Farm Animal Welfare"
  | "Animal Rescue / Shelters"
  | "Wildlife / Conservation"
  | "Animal Legal Advocacy"
  | "Alzheimer’s / Disease / Health"
  | "Flexible Emergency / Local Small Orgs"

export type ResearchStatus = "not_started" | "partial" | "complete" | "failed"

export type AceRecommendation = "Recommended" | "Standout"

export interface SourceMeta {
  sourceName: string
  fetchedAt: string
  confidenceNote: string
  sourceType?: SourceType
  reliability?: SourceReliability
}

export interface ResearchError {
  sourceName: string
  message: string
  occurredAt: string
}

export interface DonationRecord {
  id: string
  date: string
  amount: number
  note: string
}

export interface OrganizationAddress {
  street: string
  city: string
  state: string
  postalCode: string
  country: string
}

export interface Organization {
  id: string
  organizationName: string
  category: string
  subcategory: string
  approximateAnnualDonation: number
  donations: DonationRecord[]
  address: OrganizationAddress
  website: string
  ein: string
  is501c3Verified: string
  charityNavigatorRating: number | null
  charityNavigatorProfileUrl: string
  charityNavigatorAlert: string
  charityWatchGrade: string | null
  aceRecommendation: AceRecommendation | null
  programPercent: number | null
  fundraisingPercent: number | null
  adminPercent: number | null
  duplicateMission: string
  notes: string
  lastRefreshedAt: string | null
  sourceMeta: Record<string, SourceMeta>
  researchStatus: ResearchStatus
  researchAttempts: number
  researchErrors: ResearchError[]
  rankingStatus: RankingStatus
  preliminaryScore: number
  verifiedDonationWorthinessScore: number | null
  objectiveDonationWorthinessScore: number
  personalizedDonationWorthinessScore: number
  donorConfidenceAdjustment: number
  donorConfidenceReason: string
  objectiveRank: number
  personalizedRank: number
  globalObjectiveRank: number
  globalPersonalizedRank: number
  listObjectiveRank: number
  listPersonalizedRank: number
  rankingListSize: number
  rankShift: number
  rankShiftReason: string
  donationWorthinessScore: number
  impactEvidenceScore: number
  accountabilityScore: number
  financialEfficiencyScore: number | null
  financialEfficiencyStatus: "known" | "unknown"
  governanceScore: number
  politicalRiskScore: number
  confidenceScore: number
  recommendation: Recommendation
  donationAmountAssessment: string
  suggestedDonationAction: string
  suggestedDonationLevel: SuggestedDonationLevel
  legacyEligible: boolean
  legacyTier: LegacyTier
  legacyRationale: string
  missionBucket: MissionBucket
  rankingListKey: string
  rankingListLabel: string
  compactGivingRole: CompactGivingRole
  politicalInvolvementNotes: string
  impactEvidenceNotes: string
  accountabilityNotes: string
  redFlags: string[]
  nextAction: string
  criticalMissingFields: string[]
  strongestNextResearchStep: string
  scoreBreakdown?: ScoreBreakdown
}

export interface RefreshResult {
  updatedCount: number
  changedFieldsCount: number
  fetchedAt: string
  changedOrganizations: string[]
  failedOrganizations: string[]
  processedCount: number
}

export interface ResearchAuditStats {
  totalOrganizations: number
  verifiedEinCount: number
  verified501c3Count: number
  financialRatiosCount: number
  charityNavigatorCount: number
  charityWatchCount: number
  aceRecommendationCount: number
  candidGuideStarCount: number
  proPublicaForm990Count: number
  politicalNotesCount: number
  impactEvidenceNotesCount: number
  verifiedRankingCount: number
  preliminaryOnlyCount: number
}

export interface WatchdogSetupStatus {
  charityNavigator: {
    configured: boolean
    apiUrl: string
    setupUrl: string
    instructions: string
  }
  charityWatch: {
    configured: boolean
    entryCount: number
    updatedAt: string
    setupUrl: string
    instructions: string
  }
  ace: {
    configured: boolean
    recommendedCount: number
    standoutCount: number
    updatedAt: string
    setupUrl: string
    instructions: string
  }
}

export interface ScoreSpreadCheck {
  clustered: boolean
  lowerBound: number
  upperBound: number
  clusteredCount: number
  clusteredPercent: number
  warning: string | null
}

export interface RankingExplanation {
  weights: {
    impactEvidence: number
    accountability: number
    financialEfficiency: number
    governance: number
    politicalRisk: number
  }
  scoreRule: string
  confidenceRule: string
  donationAssessmentRule: string
  legacyRule: string
  rankingStatusRule: string
  preliminaryVsVerifiedRule: string
  personalizedRankRule?: string
  categoryListRule?: string
}

export interface RankingListSummary {
  key: string
  label: string
  organizationCount: number
}
