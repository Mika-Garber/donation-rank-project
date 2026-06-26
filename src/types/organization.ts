export type ScoreLevel = "Strong" | "Good" | "Moderate" | "Low" | "Unknown"

export type ScoreCategoryType = "gate" | "stewardship" | "badge" | "flag"

export interface ScoreCategoryExplanation {
  key: string
  title: string
  score: number | null
  maxPoints?: number
  weightPercent: number
  categoryType?: ScoreCategoryType
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

export type ConfidenceBand = "High" | "Medium" | "Low"

export type ScoreBand = "Exceptional" | "Strong" | "Adequate" | "Weak" | "Insufficient Data"

export type OrganizationSize = "micro" | "small" | "mid" | "large" | "unknown"

export type DuplicateMissionRole = "primary" | "secondary" | "phasing-out" | ""

export type ImpactSourceTier = "evaluator" | "annual_report_pdf" | "website" | "cause_iq" | "form_990" | "none"

export type LegalVerificationStatus =
  | "Verified"
  | "Needs Review"
  | "Failed Verification"
  | "Insufficient Data"

export type ImpactEvidenceLevel =
  | "Strong documented impact"
  | "Basic documented impact"
  | "Limited impact evidence"
  | "Not comparable / insufficient evidence"

export type FinancialCompletenessStatus = "complete" | "partial" | "missing"

export type AdvocacyReviewStatus =
  | "none_documented"
  | "nonpartisan_documented"
  | "notes_missing"
  | "not_reviewed"
  | "donor_comfort_review"
  | "partisan_red_flag"

export interface StewardshipScoreFields {
  preliminaryStewardshipScore: number
  verifiedStewardshipScore: number | null
  objectiveStewardshipScore: number
  personalizedStewardshipScore: number
  stewardshipScore: number
  stewardshipScoreLabel: string
}

export interface ScoreBreakdown extends StewardshipScoreFields {
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
  rankingStatus: RankingStatus
  legalVerificationStatus: LegalVerificationStatus
  missionFitScore: number
  impactEvidenceLevel: ImpactEvidenceLevel
  financialCompletenessStatus: FinancialCompletenessStatus
  watchdogReviewRequired: boolean
  advocacyReviewStatus: AdvocacyReviewStatus
  rankingModelVersion: string
  impactEvidenceScore: number
  accountabilityScore: number
  financialEfficiencyScore: number | null
  financialEfficiencyStatus: "known" | "unknown"
  governanceScore: number
  politicalRiskScore: number
  confidenceScore: number
  confidenceBand: ConfidenceBand
  scoreBand: ScoreBand
  organizationSize: OrganizationSize
  identityVerified: boolean
  financialsVerified: boolean
  impactDocumented: boolean
  politicalReviewed: boolean
  recommendation: Recommendation
  donationAmountAssessment: string
  suggestedDonationAction: string
  suggestedDonationLevel: SuggestedDonationLevel
  legacyEligible: boolean
  legacyTier: LegacyTier
  legacyRationale: string
  legacyExclusionReason: string | null
  missionBucket: MissionBucket
  rankingListKey: string
  rankingListLabel: string
  compactGivingRole: CompactGivingRole
  politicalInvolvementNotes: string
  impactEvidenceNotes: string
  accountabilityNotes: string
  impactSourceTier: ImpactSourceTier
  quantifiedOutcomeCount: number
  impactDataYear: number | null
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
  | "Keep Small Until Research Complete"
  | "Reduce"
  | "Small Test Donation"
  | "Review Before Donating"
  | "Pause / Do Not Fund"

export type RankingStatus =
  | "Not Researched"
  | "Preliminary"
  | "Research Partial"
  | "Research Complete"
  | "Do Not Fund / Red Flag"

export type SourceType =
  | "IRS"
  | "ProPublica/Form 990"
  | "Charity Navigator"
  | "Candid/GuideStar"
  | "Cause IQ"
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

export interface SourceMeta {
  sourceName: string
  fetchedAt: string
  confidenceNote: string
  sourceType?: SourceType
  reliability?: SourceReliability
}

export type ResearchStatus = "not_started" | "partial" | "complete" | "failed"

export type AceRecommendation = "Recommended" | "Standout"

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

export interface AdvisorExportFields {
  checkPayeeName: string
  donationMailingAddressLine1: string
  donationMailingAddressLine2: string
  donationMailingCity: string
  donationMailingState: string
  donationMailingZip: string
  donationMailingCountry: string
  advisorExportNotes: string
}

export interface AdvisorExportInput {
  checkPayeeName?: string
  donationMailingAddressLine1?: string
  donationMailingAddressLine2?: string
  donationMailingCity?: string
  donationMailingState?: string
  donationMailingZip?: string
  donationMailingCountry?: string
  advisorExportNotes?: string
}

export interface DonationYearSummary {
  year: string
  total: number
  count: number
  donations: DonationRecord[]
}

export interface Organization extends StewardshipScoreFields, AdvisorExportFields {
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
  duplicateMissionGroup: string
  duplicateMissionRole: DuplicateMissionRole
  manualOverlapGroupKey: string
  manualOverlapGroupLabel: string
  notes: string
  lastRefreshedAt: string | null
  sourceMeta: Record<string, SourceMeta>
  researchStatus: ResearchStatus
  researchAttempts: number
  researchErrors: ResearchError[]
  rankingStatus: RankingStatus
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
  legalVerificationStatus: LegalVerificationStatus
  missionFitScore: number
  impactEvidenceLevel: ImpactEvidenceLevel
  financialCompletenessStatus: FinancialCompletenessStatus
  watchdogReviewRequired: boolean
  advocacyReviewStatus: AdvocacyReviewStatus
  rankingModelVersion: string
  impactEvidenceScore: number
  accountabilityScore: number
  financialEfficiencyScore: number | null
  financialEfficiencyStatus: "known" | "unknown"
  governanceScore: number
  politicalRiskScore: number
  confidenceScore: number
  confidenceBand: ConfidenceBand
  scoreBand: ScoreBand
  organizationSize: OrganizationSize
  identityVerified: boolean
  financialsVerified: boolean
  impactDocumented: boolean
  politicalReviewed: boolean
  recommendation: Recommendation
  donationAmountAssessment: string
  suggestedDonationAction: string
  suggestedDonationLevel: SuggestedDonationLevel
  legacyEligible: boolean
  legacyTier: LegacyTier
  legacyRationale: string
  legacyExclusionReason: string | null
  missionBucket: MissionBucket
  rankingListKey: string
  rankingListLabel: string
  compactGivingRole: CompactGivingRole
  politicalInvolvementNotes: string
  impactEvidenceNotes: string
  accountabilityNotes: string
  impactSourceTier: ImpactSourceTier
  quantifiedOutcomeCount: number
  impactDataYear: number | null
  redFlags: string[]
  nextAction: string
  criticalMissingFields: string[]
  strongestNextResearchStep: string
  scoreBreakdown: ScoreBreakdown
}

export interface RankingExplanation {
  modelVersion: string
  legalVerificationRule: string
  stewardshipWeights: {
    financialEfficiency: number
    accountability: number
    governance: number
    missionFit: number
  }
  stewardshipScoreRule: string
  financialCompletenessRule: string
  impactEvidenceRule: string
  watchdogReviewRule: string
  politicalReviewRule: string
  recommendationRule: string
  confidenceRule: string
  rankingStatusRule: string
  personalizedRankRule: string
  legacyRule: string
  donationAssessmentRule: string
  categoryListRule: string
}

export interface RankingListSummary {
  key: string
  label: string
  organizationCount: number
}

export interface RefreshResult {
  updatedCount: number
  changedFieldsCount: number
  fetchedAt: string
  changedOrganizations: string[]
  failedOrganizations: string[]
  processedCount: number
}

export interface TriageQueueItem {
  id: string
  organizationName: string
  confidenceScore: number
  stewardshipScore: number
  approximateAnnualDonation: number
  missingFieldsCount: number
  recommendation: Recommendation
  nextAction: string
  priorityReasons: string[]
  researchChecklist: string[]
  triagePriority: number
}

export interface PortfolioReviewOrganizationSummary {
  id: string
  organizationName: string
  approximateAnnualDonation: number
  objectiveStewardshipScore: number
  stewardshipScore: number
  impactEvidenceScore: number
  impactEvidenceLevel: ImpactEvidenceLevel
  confidenceScore: number
  confidenceBand: ConfidenceBand
  recommendation: Recommendation
  rankingStatus: RankingStatus
  stewardshipScoreLabel: string
  legacyTier: LegacyTier
  legacyEligible: boolean
  rankingListLabel: string
  listObjectiveRank: number
  rankingListSize: number
  listRankLabel: string
  impactSourceTier: ImpactSourceTier
  impactSourceTierLabel: string
  quantifiedOutcomeCount: number
  giftSharePercent: number
  reviewFlag: string | null
  duplicateMission: string
  duplicateMissionGroup: string
  duplicateMissionRole: DuplicateMissionRole
}

export interface PortfolioConsolidationSummary {
  totalOrganizations: number
  totalAnnualGiving: number
  continueRecommendationCount: number
  continueAnnualGiving: number
  continueGivingSharePercent: number
  priorityFundCount: number
  keepCount: number
  reviewOrReduceCount: number
  legacyEligibleCount: number
  legacyCoreCount: number
  suggestedFocusMin: number
  suggestedFocusMax: number
  excessContinueCount: number
  headline: string
  guidance: string
}

export interface MissionOverlapGroupSummary {
  groupId: string
  groupLabel: string
  organizationCount: number
  totalAnnualGiving: number
  hasPrimary: boolean
  consolidationNote: string
  organizations: PortfolioReviewOrganizationSummary[]
}

export interface PortfolioReviewResponse {
  consolidation: PortfolioConsolidationSummary
  topByAnnualGift: PortfolioReviewOrganizationSummary[]
  highGiftOutliers: PortfolioReviewOrganizationSummary[]
  researchGaps: PortfolioReviewOrganizationSummary[]
  suggestedCoreCandidates: PortfolioReviewOrganizationSummary[]
  missionOverlapGroups: MissionOverlapGroupSummary[]
  ungroupedDuplicateFlags: PortfolioReviewOrganizationSummary[]
}

export type PortfolioRole =
  | "Core Pick"
  | "Category Leader"
  | "Backup Candidate"
  | "Unique Mission"
  | "Overlapping / Lower Priority"
  | "Review Before Core"
  | "Phase Out Candidate"

export type BroadPortfolioArea = "Animals" | "Human Services" | "Medical" | "Veterans" | "Environment" | "Other"

export type SpeciesFocus =
  | "dogs"
  | "cats"
  | "equine"
  | "wildlife"
  | "farm animals"
  | "mixed animals"
  | "none"

export type InterventionType =
  | "rescue adoption"
  | "sanctuary"
  | "tnr spay-neuter"
  | "service dogs"
  | "retired k9 care"
  | "legal advocacy"
  | "anti-cruelty"
  | "wildlife conservation"
  | "wildlife rehab"
  | "national welfare"
  | "local shelter"
  | "international welfare"
  | "disaster rescue"
  | "medical care"
  | "medical research"
  | "human services"
  | "farm animal sanctuary"
  | "equine sanctuary"
  | "special-needs rescue"
  | "other"

export type PortfolioGroupingStatus = "classified" | "needs_manual_review"

export interface PortfolioConcentrationOrganization {
  id: string
  organizationName: string
  broadPortfolioArea: BroadPortfolioArea
  speciesFocus: SpeciesFocus
  interventionType: InterventionType
  overlapGroupKey: string
  overlapGroupLabel: string
  secondaryOverlapTags: string[]
  groupingStatus: PortfolioGroupingStatus
  groupRank: number
  groupSize: number
  portfolioRole: PortfolioRole
  roleReason: string
  missionBucket: MissionBucket
  approximateAnnualDonation: number
  stewardshipScore: number
  objectiveStewardshipScore: number
  recommendation: Recommendation
  rankingStatus: RankingStatus
  legalVerificationStatus: LegalVerificationStatus
  financialCompletenessStatus: FinancialCompletenessStatus
  impactEvidenceLevel: ImpactEvidenceLevel
  watchdogReviewRequired: boolean
  advocacyReviewStatus: AdvocacyReviewStatus
  confidenceScore: number
  confidenceBand: ConfidenceBand
  listObjectiveRank: number
  rankingListLabel: string
}

export interface PortfolioConcentrationGroup {
  overlapGroupKey: string
  overlapGroupLabel: string
  broadPortfolioArea: BroadPortfolioArea
  speciesFocus: SpeciesFocus
  interventionType: InterventionType
  organizationCount: number
  categoryLeaderId: string | null
  categoryLeaderName: string | null
  suggestedCorePickId: string | null
  suggestedCorePickName: string | null
  suggestedDecisionSummary: string
  needsReview: boolean
  organizations: PortfolioConcentrationOrganization[]
}

export type ClientSuggestedAction =
  | "Keep in final list"
  | "Strong candidate"
  | "Review before final list"
  | "Similar to stronger charity"
  | "Consider reducing"
  | "Consider pausing"

export interface PortfolioConcentrationClientCharity {
  id: string
  organizationName: string
  area: string
  whyItMadeTheList: string
  currentGift: number
  suggestedAction: ClientSuggestedAction
}

export interface PortfolioConcentrationReviewItem {
  id: string
  organizationName: string
  concern: string
  nextStep: string
}

export interface PortfolioConcentrationOverlapSummary {
  overlapGroupLabel: string
  bestCurrentPick: string | null
  similarCharitiesToReview: string[]
  suggestedDecision: string
  totalKnownGiving: number
}

export interface PortfolioConcentrationSummary {
  finalPortfolioTargetMin: number
  finalPortfolioTargetMax: number
  totalOrganizationsReviewed: number
  recommendedCorePickCount: number
  groupsWithCategoryLeaderCount: number
  groupsNeedingReviewCount: number
  overlappingLowerPriorityCount: number
  phaseOutCandidateCount: number
  needsManualGroupingReviewCount: number
  suggestedCorePortfolioCount: number
  headline: string
  guidance: string
  totalKnownAnnualGiving: number
  suggestedCoreKnownAnnualGiving: number
  missingGiftAmountCount: number
  qualifiedCoreCandidateCount: number
  suggestedFinalListCount: number
  reviewBeforeFinalCount: number
  clientHeadline: string
  clientSubheadline: string
  qualifiedVsSuggestedNote: string
}

export interface PortfolioConcentrationResponse {
  summary: PortfolioConcentrationSummary
  overlapGroups: PortfolioConcentrationGroup[]
  suggestedCorePortfolio: PortfolioConcentrationOrganization[]
  suggestedFinalList: PortfolioConcentrationClientCharity[]
  reviewBeforeFinalDecision: PortfolioConcentrationReviewItem[]
  importantOverlapGroups: PortfolioConcentrationOverlapSummary[]
  groupsNeedingReview: PortfolioConcentrationGroup[]
  overlappingOrganizations: PortfolioConcentrationOrganization[]
  phaseOutCandidates: PortfolioConcentrationOrganization[]
  needsManualGroupingReview: PortfolioConcentrationOrganization[]
}

export interface GivingPlanGroup {
  missionBucket: MissionBucket
  totalCurrentAnnualDonations: number
  organizationCount: number
  suggestedKeepCount: number
  topRecommended: Organization[]
  promisingUnverified: Organization[]
  reduceOrPause: Organization[]
  consolidationReason: string
}

export interface LegacyExcludedOrganization {
  id: string
  organizationName: string
  missionBucket: MissionBucket
  reason: string
}

export interface LegacyPlanAreaGroup {
  missionArea: LegacyMissionArea
  defaultAllocationPercent: number
  organizations: Organization[]
}

export interface LegacyPlanResponse {
  allocationDefaults: Record<LegacyMissionArea, number>
  legacyRules: string[]
  organizationsByArea: LegacyPlanAreaGroup[]
  excludedOrganizations: LegacyExcludedOrganization[]
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
  preliminaryCount: number
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

export interface ResearchAuditResponse {
  stats: ResearchAuditStats
  spreadCheck: ScoreSpreadCheck
  rankingStatusCounts: Record<RankingStatus, number>
  message: string
}
