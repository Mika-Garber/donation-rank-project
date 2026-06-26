import { RECOMMENDATION_THRESHOLDS } from "../config/ranking-config.js"
import type {
  BroadPortfolioArea,
  ClientSuggestedAction,
  InterventionType,
  Organization,
  PortfolioConcentrationClientCharity,
  PortfolioConcentrationGroup,
  PortfolioConcentrationOrganization,
  PortfolioConcentrationOverlapSummary,
  PortfolioConcentrationResponse,
  PortfolioConcentrationReviewItem,
  PortfolioConcentrationSummary,
  PortfolioGroupingStatus,
  PortfolioRole,
  Recommendation,
  SpeciesFocus,
} from "../types/organization.js"
import { impactEvidenceLevelMeetsBasic } from "./impact-metadata-service.js"
import { resolveObjectiveStewardshipScore } from "./stewardship-score-fields.js"

const FINAL_PORTFOLIO_TARGET_MIN = 15
const FINAL_PORTFOLIO_TARGET_MAX = 20
const MAX_CORE_PER_MISSION_BUCKET = 6

const RECOMMENDATION_RANK: Record<Recommendation, number> = {
  "Priority Fund": 7,
  Keep: 6,
  "Keep Small Until Research Complete": 5,
  "Small Test Donation": 4,
  "Review Before Donating": 3,
  Reduce: 2,
  "Pause / Do Not Fund": 1,
}

export interface OverlapClassification {
  broadPortfolioArea: BroadPortfolioArea
  speciesFocus: SpeciesFocus
  interventionType: InterventionType
  overlapGroupKey: string
  overlapGroupLabel: string
  secondaryOverlapTags: string[]
  groupingStatus: PortfolioGroupingStatus
}

function includesAny(haystack: string, terms: string[]): boolean {
  return terms.some((term) => haystack.includes(term))
}

function formatGroupLabel(groupId: string): string {
  return groupId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function buildHaystack(organization: Organization): string {
  return `${organization.organizationName} ${organization.subcategory} ${organization.category} ${organization.notes} ${organization.impactEvidenceNotes} ${organization.accountabilityNotes} ${organization.rankingListLabel}`
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function buildProfileHaystack(organization: Organization): string {
  return `${organization.organizationName} ${organization.subcategory} ${organization.category} ${organization.notes} ${organization.rankingListLabel}`
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function isAnimalLegalAdvocacyMission(haystack: string, name: string, bucket: string): boolean {
  if (bucket === "Animal Legal Advocacy") return true
  return (
    includesAny(name, ["animal legal defense", "aldf"]) ||
    includesAny(haystack, [
      "animal legal defense",
      "animal legal advocacy",
      "animal law",
      "legal defense fund",
      "litigation on behalf of animals",
    ])
  )
}

function isHumanMedicalMission(name: string, profileHaystack: string): boolean {
  if (includesAny(name, ["restless legs", "alzheimer", "cure alzheimer"])) return true
  if (includesAny(profileHaystack, ["animal shelter", "animal rescue", "spca", "humane society"])) return false
  return (
    includesAny(name, ["syndrome foundation", "disease fund"]) &&
    includesAny(profileHaystack, ["disease", "syndrome", "medical", "health research"])
  )
}

function isEnvironmentNonWildlifeMission(name: string, haystack: string): boolean {
  return includesAny(name, ["rails to trails"]) || includesAny(haystack, ["rail-trail", "trail development", "biking trail"])
}

function isRetiredK9Mission(haystack: string): boolean {
  return includesAny(haystack, [
    "retired k9",
    "retired police",
    "retired military k9",
    "project k-9 hero",
    "project k9 hero",
    "k9 hero",
    "paws of honor",
    "vested interest in k9",
  ])
}

function isWorkingDogVeteranServiceMission(haystack: string): boolean {
  if (
    includesAny(haystack, [
      "wounded warrior project",
      "wounded warrior",
      "paws of war",
      "feeding pets of the homeless",
    ])
  ) {
    return false
  }
  return includesAny(haystack, [
    "k9s for warriors",
    "k9 for warriors",
    "service dog",
    "assistance dog",
    "vetdog",
    "veteran",
    "semper k9",
    "guardian angels medical service dogs",
    "mutts with a mission",
    "irondog k9",
    "working dog",
  ])
}

function isGuideDogMission(haystack: string): boolean {
  return includesAny(haystack, ["guide dog", "seeing eye", "guide dogs for the blind"])
}

function isDisasterEmergencyMission(haystack: string): boolean {
  return includesAny(haystack, [
    "disaster",
    "emergency rescue",
    "emergency animal",
    "red rover",
    "animal disaster",
    "north valley animal disaster",
  ])
}

function isCatTnrMission(haystack: string): boolean {
  return includesAny(haystack, [
    "tnr",
    "trap neuter",
    "trap-neuter",
    "spay neuter",
    "spay-neuter",
    "community cat",
    "feral cat",
    "alleycat",
    "alley cat allies",
  ])
}

function isAntiCrueltyInvestigationMission(haystack: string, bucket: string): boolean {
  if (bucket === "Animal Legal Advocacy") return false
  return includesAny(haystack, [
    "investigation",
    "cruelty investigator",
    "animal recovery mission",
    "arm investigation",
    "undercover investigation",
    "anti-cruelty enforcement",
  ])
}

function isWildlifeRehabMission(haystack: string): boolean {
  return includesAny(haystack, [
    "wildlife rehab",
    "rehabilitation center",
    "rehabilitat",
    "wildlife rescue",
    "wildlife sanctuary",
    "wolf sanctuary",
  ])
}

function isWildlifeConservationMission(haystack: string, bucket: string): boolean {
  if (isWildlifeRehabMission(haystack)) return false
  return (
    bucket === "Wildlife / Conservation" ||
    includesAny(haystack, ["conservation", "habitat protection", "protect wildlife", "wildlife conservation"])
  )
}

function isInternationalAnimalMission(haystack: string): boolean {
  return includesAny(haystack, [
    "international fund for animal welfare",
    "ifaw",
    "network for animals",
    "worldwide",
    "global animal",
    "international animal",
    "across the globe",
    "countries and territories",
  ])
}

function isBroadNationalAnimalMission(haystack: string, name: string): boolean {
  return includesAny(haystack, [
    "best friends animal society",
    "humane world for animals",
    "humane society of the united states",
    "north shore animal league",
    "peta",
    "american society for the prevention of cruelty",
    "aspca",
    "national anti-vivisection",
  ]) || includesAny(name, ["peta", "ifaw"])
}

function isLocalMultiserviceShelter(haystack: string, name: string): boolean {
  return includesAny(haystack, [
    "mspca",
    "spca",
    "humane society",
    "animal shelter",
    "animal rescue league",
    "second chance animal services",
    "houston spca",
    "northeast animal shelter",
  ]) || includesAny(name, ["mspca", "spca"])
}

function isSpecialNeedsSeniorMission(haystack: string, name: string): boolean {
  return includesAny(haystack, [
    "senior dog",
    "senior cat",
    "special needs",
    "medical rescue",
    "hospice",
    "whispering willows",
    "heaths haven",
  ]) || includesAny(name, ["senior", "special needs"])
}

function isFarmAnimalSanctuary(haystack: string, bucket: string): boolean {
  return (
    bucket === "Farm Animal Welfare" ||
    includesAny(haystack, ["farm sanctuary", "farm animal sanctuary", "farm animal welfare", "sanctuary for farm"])
  )
}

function isEquineSanctuary(haystack: string, subcategory: string): boolean {
  return (
    subcategory.includes("horse") ||
    includesAny(haystack, ["equine sanctuary", "donkey rescue", "donkey sanctuary", "mule refuge", "mule sanctuary", "miniature donkey"])
  )
}

function isDogRescueAdoption(profileHaystack: string, subcategory: string, name: string): boolean {
  if (isRetiredK9Mission(profileHaystack) || isWorkingDogVeteranServiceMission(profileHaystack) || isGuideDogMission(profileHaystack)) {
    return false
  }
  if (subcategory.includes("cat") || name.includes("feline") || name.includes("cat")) return false
  return (
    subcategory.includes("dog") ||
    includesAny(name, ["dog rescue", "canine", "puppy"]) ||
    includesAny(profileHaystack, [" dog rescue", "dog adoption", "canine rescue", "puppy rescue", "dog shelter"])
  )
}

function isCatRescueAdoption(profileHaystack: string, fullHaystack: string, subcategory: string, name: string): boolean {
  if (isCatTnrMission(fullHaystack) && !subcategory.includes("cat") && !name.includes("feline")) return false
  if (subcategory.includes("cat") || name.includes("feline") || name.includes("cat")) {
    if (isCatTnrMission(fullHaystack) && includesAny(fullHaystack, ["advocacy", "tnr", "spay neuter", "spay-neuter"])) return false
    return true
  }
  return includesAny(profileHaystack, [" cat rescue", "cat adoption", "feline rescue", "kitten rescue", "cat shelter", "feline"])
}

function deriveSpeciesFocus(haystack: string, subcategory: string, interventionType: InterventionType): SpeciesFocus {
  if (interventionType === "wildlife conservation" || interventionType === "wildlife rehab") return "wildlife"
  if (interventionType === "farm animal sanctuary") return "farm animals"
  if (interventionType === "equine sanctuary") return "equine"
  if (isEquineSanctuary(haystack, subcategory)) return "equine"
  if (subcategory.includes("dog") || includesAny(haystack, [" dog", "canine", "k9", "puppy"])) return "dogs"
  if (subcategory.includes("cat") || includesAny(haystack, [" cat", "feline", "kitten"])) return "cats"
  if (includesAny(haystack, ["wildlife", "elephant", "wolf", "marine"])) return "wildlife"
  if (includesAny(haystack, ["farm animal", "farm sanctuary", "livestock"])) return "farm animals"
  if (includesAny(haystack, ["horse", "equine", "donkey", "mule"])) return "equine"
  return "mixed animals"
}

function deriveBroadPortfolioArea(organization: Organization, haystack: string): BroadPortfolioArea {
  if (organization.missionBucket === "Alzheimer’s / Disease / Health" || haystack.includes("alzheimer")) return "Medical"
  if (includesAny(haystack, ["wounded warrior", "human services", "family support"])) return "Human Services"
  if (includesAny(haystack, ["veteran"]) && !includesAny(haystack, ["dog", "k9", "service dog"])) return "Veterans"
  if (organization.missionBucket === "Wildlife / Conservation" || includesAny(haystack, ["conservation", "environment"])) {
    return "Environment"
  }
  if (
    organization.missionBucket === "Animal Rescue / Shelters" ||
    organization.missionBucket === "Animal Legal Advocacy" ||
    organization.missionBucket === "Farm Animal Welfare" ||
    organization.missionBucket === "Veterinary / Medical Animal Care" ||
    organization.category.toLowerCase().includes("animal")
  ) {
    return "Animals"
  }
  return "Other"
}

function buildClassification(
  broadPortfolioArea: BroadPortfolioArea,
  speciesFocus: SpeciesFocus,
  interventionType: InterventionType,
  overlapGroupKey: string,
  overlapGroupLabel: string,
  secondaryOverlapTags: string[],
  groupingStatus: PortfolioGroupingStatus,
): OverlapClassification {
  return {
    broadPortfolioArea,
    speciesFocus,
    interventionType,
    overlapGroupKey,
    overlapGroupLabel,
    secondaryOverlapTags,
    groupingStatus,
  }
}

function classifyFromManualOverride(organization: Organization): OverlapClassification | null {
  const manualKey = organization.manualOverlapGroupKey?.trim()
  const manualLabel = organization.manualOverlapGroupLabel?.trim()
  if (manualKey && manualLabel) {
    return buildClassification("Animals", "mixed animals", "other", manualKey, manualLabel, [], "classified")
  }
  const tagGroup = organization.duplicateMissionGroup?.trim()
  if (tagGroup) {
    const normalized = tagGroup.toLowerCase().replace(/\s+/g, "-")
    return buildClassification(
      deriveBroadPortfolioArea(organization, buildHaystack(organization)),
      "mixed animals",
      "other",
      `tag:${normalized}`,
      formatGroupLabel(normalized),
      [],
      "classified",
    )
  }
  return null
}

function classifyNonAnimalOrganization(organization: Organization, haystack: string): OverlapClassification | null {
  const bucket = organization.missionBucket
  const name = organization.organizationName.toLowerCase()
  const profileHaystack = buildProfileHaystack(organization)

  if (isHumanMedicalMission(name, profileHaystack)) {
    if (includesAny(name, ["alzheimer"]) || includesAny(haystack, ["alzheimer"])) {
      return buildClassification(
        "Medical",
        "none",
        "medical research",
        "alzheimers-research",
        "Alzheimer's research",
        [],
        "classified",
      )
    }
    return buildClassification(
      "Medical",
      "none",
      "medical research",
      `medical-research::${organization.id}`,
      "Medical / disease research",
      [],
      groupingStatusForUnclear(name, haystack),
    )
  }

  if (bucket === "Alzheimer’s / Disease / Health" || haystack.includes("alzheimer")) {
    return buildClassification(
      "Medical",
      "none",
      "medical research",
      "alzheimers-research",
      "Alzheimer's research",
      [],
      "classified",
    )
  }

  if (includesAny(haystack, ["human services", "family support"])) {
    return buildClassification(
      "Human Services",
      "none",
      "human services",
      "human-services-family",
      "Human services / family support",
      [],
      "classified",
    )
  }

  if (isEnvironmentNonWildlifeMission(name, haystack)) {
    return buildClassification(
      "Environment",
      "none",
      "other",
      `environment-other::${organization.id}`,
      "Needs manual grouping review",
      [],
      "needs_manual_review",
    )
  }

  return null
}

function groupingStatusForUnclear(name: string, haystack: string): PortfolioGroupingStatus {
  if (includesAny(name, ["foundation", "fund", "institute"]) || includesAny(haystack, ["research", "disease"])) {
    return "classified"
  }
  return "needs_manual_review"
}

function classifyAnimalOrganization(organization: Organization, haystack: string): OverlapClassification {
  const bucket = organization.missionBucket
  const subcategory = organization.subcategory.toLowerCase()
  const name = organization.organizationName.toLowerCase()
  const profileHaystack = buildProfileHaystack(organization)
  const secondaryTags: string[] = []

  if (includesAny(name, ["world wildlife fund", "wwf"])) {
    return buildClassification(
      "Environment",
      "wildlife",
      "wildlife conservation",
      "wildlife-conservation",
      "Wildlife conservation",
      secondaryTags,
      "classified",
    )
  }

  if (isRetiredK9Mission(haystack)) {
    return buildClassification(
      "Animals",
      "dogs",
      "retired k9 care",
      "retired-k9-care",
      "Retired police or military K9 care",
      secondaryTags,
      "classified",
    )
  }

  if (isWorkingDogVeteranServiceMission(haystack)) {
    return buildClassification(
      "Animals",
      "dogs",
      "service dogs",
      "working-dogs-veterans-service",
      "Working dogs / veterans / service dogs",
      secondaryTags,
      "classified",
    )
  }

  if (isGuideDogMission(haystack)) {
    return buildClassification(
      "Animals",
      "dogs",
      "service dogs",
      "guide-assistance-dogs",
      "Guide dogs / assistance dogs",
      secondaryTags,
      "classified",
    )
  }

  if (isDisasterEmergencyMission(haystack)) {
    return buildClassification(
      "Animals",
      deriveSpeciesFocus(haystack, subcategory, "disaster rescue"),
      "disaster rescue",
      "disaster-emergency-animal-rescue",
      "Disaster / emergency animal rescue",
      secondaryTags,
      "classified",
    )
  }

  if (isLocalMultiserviceShelter(profileHaystack, name)) {
    return buildClassification(
      "Animals",
      "mixed animals",
      "local shelter",
      "local-multiservice-shelter",
      "Local multiservice animal shelter",
      secondaryTags,
      "classified",
    )
  }

  if (isAnimalLegalAdvocacyMission(haystack, name, bucket)) {
    return buildClassification(
      "Animals",
      "mixed animals",
      "legal advocacy",
      "animal-legal-advocacy",
      "Animal legal advocacy",
      secondaryTags,
      "classified",
    )
  }

  if (isAntiCrueltyInvestigationMission(haystack, bucket)) {
    return buildClassification(
      "Animals",
      "mixed animals",
      "anti-cruelty",
      "anti-cruelty-investigations",
      "Anti-cruelty / investigations",
      secondaryTags,
      "classified",
    )
  }

  if (isCatTnrMission(haystack)) {
    if (isCatRescueAdoption(profileHaystack, haystack, subcategory, name)) secondaryTags.push("cat rescue / adoption")
    return buildClassification(
      "Animals",
      "cats",
      "tnr spay-neuter",
      "cat-tnr-spay-neuter",
      "Cat TNR / spay-neuter",
      secondaryTags,
      "classified",
    )
  }

  if (isFarmAnimalSanctuary(haystack, bucket)) {
    return buildClassification(
      "Animals",
      "farm animals",
      "farm animal sanctuary",
      "farm-animal-sanctuary",
      "Farm animal sanctuary",
      secondaryTags,
      "classified",
    )
  }

  if (isWildlifeRehabMission(haystack)) {
    return buildClassification(
      "Animals",
      "wildlife",
      "wildlife rehab",
      "wildlife-rehab",
      "Wildlife rescue / rehabilitation",
      secondaryTags,
      "classified",
    )
  }

  if (isWildlifeConservationMission(haystack, bucket)) {
    return buildClassification(
      "Environment",
      "wildlife",
      "wildlife conservation",
      "wildlife-conservation",
      "Wildlife conservation",
      secondaryTags,
      "classified",
    )
  }

  if (isEquineSanctuary(haystack, subcategory)) {
    return buildClassification(
      "Animals",
      "equine",
      "equine sanctuary",
      "equine-donkey-mule-sanctuary",
      "Equine / donkey / mule sanctuary",
      secondaryTags,
      "classified",
    )
  }

  if (isSpecialNeedsSeniorMission(haystack, name)) {
    return buildClassification(
      "Animals",
      deriveSpeciesFocus(haystack, subcategory, "special-needs rescue"),
      "special-needs rescue",
      "special-needs-senior-rescue",
      "Special-needs / senior / medical animal rescue",
      secondaryTags,
      "classified",
    )
  }

  if (isInternationalAnimalMission(haystack)) {
    return buildClassification(
      "Animals",
      "mixed animals",
      "international welfare",
      "international-animal-welfare",
      "International animal welfare",
      secondaryTags,
      "classified",
    )
  }

  if (isBroadNationalAnimalMission(haystack, name)) {
    return buildClassification(
      "Animals",
      "mixed animals",
      "national welfare",
      "broad-national-animal-welfare",
      "Broad national animal welfare",
      secondaryTags,
      "classified",
    )
  }

  if (bucket === "Veterinary / Medical Animal Care") {
    return buildClassification(
      "Animals",
      deriveSpeciesFocus(haystack, subcategory, "medical care"),
      "medical care",
      "veterinary-medical-animal",
      "Veterinary / medical animal care",
      secondaryTags,
      "classified",
    )
  }

  if (isCatRescueAdoption(profileHaystack, haystack, subcategory, name)) {
    return buildClassification(
      "Animals",
      "cats",
      "rescue adoption",
      "cat-rescue-adoption",
      "Cat rescue / adoption",
      secondaryTags,
      "classified",
    )
  }

  if (isDogRescueAdoption(profileHaystack, subcategory, name)) {
    return buildClassification(
      "Animals",
      "dogs",
      "rescue adoption",
      "dog-rescue-adoption",
      "Dog rescue / adoption",
      secondaryTags,
      "classified",
    )
  }

  if (organization.rankingListKey && organization.rankingListKey !== `${bucket}::general`) {
    return buildClassification(
      "Animals",
      deriveSpeciesFocus(haystack, subcategory, "other"),
      "other",
      organization.rankingListKey,
      organization.rankingListLabel || bucket,
      secondaryTags,
      "classified",
    )
  }

  if (bucket === "Animal Rescue / Shelters" || bucket === "Farm Animal Welfare" || bucket === "Wildlife / Conservation") {
    return buildClassification(
      "Animals",
      deriveSpeciesFocus(haystack, subcategory, "other"),
      "other",
      `needs-manual-grouping-review::${organization.id}`,
      "Needs manual grouping review",
      secondaryTags,
      "needs_manual_review",
    )
  }

  return buildClassification(
    deriveBroadPortfolioArea(organization, haystack),
    deriveSpeciesFocus(haystack, subcategory, "other"),
    "other",
    organization.rankingListKey || `${bucket}::general`,
    organization.rankingListLabel || bucket,
    secondaryTags,
    "classified",
  )
}

export function classifyOrganizationOverlap(organization: Organization): OverlapClassification {
  const manual = classifyFromManualOverride(organization)
  if (manual) return manual

  const haystack = buildHaystack(organization)
  const nonAnimal = classifyNonAnimalOrganization(organization, haystack)
  if (nonAnimal) return nonAnimal

  return classifyAnimalOrganization(organization, haystack)
}

export function deriveOverlapGroup(organization: Organization): {
  overlapGroupKey: string
  overlapGroupLabel: string
} {
  const classification = classifyOrganizationOverlap(organization)
  return {
    overlapGroupKey: classification.overlapGroupKey,
    overlapGroupLabel: classification.overlapGroupLabel,
  }
}

function compareOrganizationsInGroup(left: Organization, right: Organization): number {
  const stewardshipDiff = resolveObjectiveStewardshipScore(right) - resolveObjectiveStewardshipScore(left)
  if (stewardshipDiff !== 0) return stewardshipDiff

  const recommendationDiff = RECOMMENDATION_RANK[right.recommendation] - RECOMMENDATION_RANK[left.recommendation]
  if (recommendationDiff !== 0) return recommendationDiff

  const confidenceDiff = right.confidenceScore - left.confidenceScore
  if (confidenceDiff !== 0) return confidenceDiff

  if (right.rankingStatus === "Research Complete" && left.rankingStatus !== "Research Complete") return 1
  if (left.rankingStatus === "Research Complete" && right.rankingStatus !== "Research Complete") return -1

  if (right.legalVerificationStatus === "Verified" && left.legalVerificationStatus !== "Verified") return 1
  if (left.legalVerificationStatus === "Verified" && right.legalVerificationStatus !== "Verified") return -1

  return left.listObjectiveRank - right.listObjectiveRank
}

function isCorePickEligible(organization: Organization): boolean {
  return (
    organization.rankingStatus === "Research Complete" &&
    organization.legalVerificationStatus === "Verified" &&
    organization.stewardshipScore >= RECOMMENDATION_THRESHOLDS.priorityFundScoreMin &&
    organization.confidenceScore >= RECOMMENDATION_THRESHOLDS.highConfidenceMin &&
    (organization.recommendation === "Priority Fund" || organization.recommendation === "Keep") &&
    !organization.watchdogReviewRequired &&
    organization.advocacyReviewStatus !== "donor_comfort_review" &&
    organization.advocacyReviewStatus !== "partisan_red_flag" &&
    impactEvidenceLevelMeetsBasic(organization.impactEvidenceLevel)
  )
}

function hasReviewBlocker(organization: Organization): boolean {
  return (
    organization.watchdogReviewRequired ||
    organization.advocacyReviewStatus === "donor_comfort_review" ||
    organization.advocacyReviewStatus === "partisan_red_flag" ||
    organization.financialCompletenessStatus !== "complete" ||
    organization.rankingStatus !== "Research Complete" ||
    organization.legalVerificationStatus !== "Verified"
  )
}

function buildReviewReason(organization: Organization): string {
  const reasons: string[] = []
  if (organization.watchdogReviewRequired) reasons.push("watchdog review recommended")
  if (organization.advocacyReviewStatus === "donor_comfort_review") reasons.push("donor comfort review on advocacy")
  if (organization.advocacyReviewStatus === "partisan_red_flag") reasons.push("partisan activity review")
  if (organization.rankingStatus !== "Research Complete") reasons.push("research is not complete")
  if (organization.legalVerificationStatus !== "Verified") reasons.push(`legal status is ${organization.legalVerificationStatus}`)
  if (organization.financialCompletenessStatus !== "complete") reasons.push("financial ratios are incomplete")
  return reasons.join("; ")
}

function isPhaseOutCandidate(organization: Organization, isNotLeader: boolean): boolean {
  if (organization.recommendation === "Pause / Do Not Fund") return true
  if (organization.legalVerificationStatus === "Failed Verification") return true
  if (organization.rankingStatus === "Do Not Fund / Red Flag") return true
  if (organization.recommendation === "Reduce" && isNotLeader) return true
  if (
    isNotLeader &&
    organization.stewardshipScore < RECOMMENDATION_THRESHOLDS.reviewScoreMin &&
    organization.recommendation !== "Priority Fund" &&
    organization.recommendation !== "Keep"
  ) {
    return true
  }
  return false
}

function assignPortfolioRole(
  organization: Organization,
  groupRank: number,
  groupSize: number,
  groupingStatus: PortfolioGroupingStatus,
): { portfolioRole: PortfolioRole; roleReason: string } {
  const isLeader = groupRank === 1
  const isStrongBackup = groupRank === 2 && resolveObjectiveStewardshipScore(organization) >= RECOMMENDATION_THRESHOLDS.keepScoreMin

  if (groupingStatus === "needs_manual_review") {
    return {
      portfolioRole: "Unique Mission",
      roleReason: "Mission overlap is unclear from current data — review manually before comparing to peers.",
    }
  }

  if (isPhaseOutCandidate(organization, !isLeader)) {
    return {
      portfolioRole: "Phase Out Candidate",
      roleReason: isLeader
        ? "Lowest-priority org in this group with Reduce/Pause recommendation or failed verification."
        : "Lower stewardship or Reduce/Pause recommendation while a stronger peer exists in this overlap group.",
    }
  }

  if (
    hasReviewBlocker(organization) &&
    (organization.recommendation === "Priority Fund" ||
      organization.recommendation === "Keep" ||
      resolveObjectiveStewardshipScore(organization) >= RECOMMENDATION_THRESHOLDS.keepScoreMin)
  ) {
    return {
      portfolioRole: "Review Before Core",
      roleReason: `Strong stewardship but unresolved review items: ${buildReviewReason(organization)}.`,
    }
  }

  if (groupSize === 1) {
    if (isCorePickEligible(organization)) {
      return {
        portfolioRole: "Core Pick",
        roleReason: "Only org in this overlap group and meets core portfolio eligibility.",
      }
    }
    return {
      portfolioRole: "Unique Mission",
      roleReason: "Covers a distinct overlap area with no direct peer in the portfolio.",
    }
  }

  if (isLeader) {
    if (isCorePickEligible(organization)) {
      return {
        portfolioRole: "Core Pick",
        roleReason: "Top-ranked org in this overlap group with research-complete, verified, high-confidence stewardship.",
      }
    }
    return {
      portfolioRole: "Category Leader",
      roleReason: "Highest-ranked eligible org in this overlap group by stewardship, recommendation, and confidence.",
    }
  }

  if (isStrongBackup) {
    return {
      portfolioRole: "Backup Candidate",
      roleReason: "Second-strongest org in this group — viable backup if the category leader is not chosen.",
    }
  }

  return {
    portfolioRole: "Overlapping / Lower Priority",
    roleReason: "Similar mission to a stronger charity in this overlap group.",
  }
}

function toConcentrationOrganization(
  organization: Organization,
  classification: OverlapClassification,
  groupRank: number,
  groupSize: number,
  portfolioRole: PortfolioRole,
  roleReason: string,
): PortfolioConcentrationOrganization {
  return {
    id: organization.id,
    organizationName: organization.organizationName,
    broadPortfolioArea: classification.broadPortfolioArea,
    speciesFocus: classification.speciesFocus,
    interventionType: classification.interventionType,
    overlapGroupKey: classification.overlapGroupKey,
    overlapGroupLabel: classification.overlapGroupLabel,
    secondaryOverlapTags: classification.secondaryOverlapTags,
    groupingStatus: classification.groupingStatus,
    groupRank,
    groupSize,
    portfolioRole,
    roleReason,
    missionBucket: organization.missionBucket,
    approximateAnnualDonation: Math.round(organization.approximateAnnualDonation),
    stewardshipScore: organization.stewardshipScore,
    objectiveStewardshipScore: organization.objectiveStewardshipScore,
    recommendation: organization.recommendation,
    rankingStatus: organization.rankingStatus,
    legalVerificationStatus: organization.legalVerificationStatus,
    financialCompletenessStatus: organization.financialCompletenessStatus,
    impactEvidenceLevel: organization.impactEvidenceLevel,
    watchdogReviewRequired: organization.watchdogReviewRequired,
    advocacyReviewStatus: organization.advocacyReviewStatus,
    confidenceScore: organization.confidenceScore,
    confidenceBand: organization.confidenceBand,
    listObjectiveRank: organization.listObjectiveRank,
    rankingListLabel: organization.rankingListLabel,
  }
}

function buildGroupDecisionSummary(
  overlapGroupLabel: string,
  groupOrganizations: PortfolioConcentrationOrganization[],
): string {
  if (groupOrganizations.length === 0) return "No organizations in this group."

  const leader = groupOrganizations.find((organization) => organization.groupRank === 1)
  const backups = groupOrganizations.filter((organization) => organization.portfolioRole === "Backup Candidate")
  const reviewOrgs = groupOrganizations.filter((organization) => organization.portfolioRole === "Review Before Core")
  const lowerPriority = groupOrganizations.filter(
    (organization) => organization.portfolioRole === "Overlapping / Lower Priority" || organization.portfolioRole === "Phase Out Candidate",
  )

  const parts: string[] = [`${overlapGroupLabel}:`]
  if (leader) {
    parts.push(
      leader.portfolioRole === "Core Pick"
        ? `${leader.organizationName} is the strongest core candidate in this group.`
        : `${leader.organizationName} is the category leader in this group.`,
    )
  }
  if (reviewOrgs.length > 0) {
    parts.push(
      `${reviewOrgs.map((organization) => organization.organizationName).join(", ")} ${reviewOrgs.length === 1 ? "has" : "have"} strong stewardship but ${reviewOrgs.length === 1 ? "requires" : "require"} review before core status.`,
    )
  }
  if (backups.length > 0) {
    parts.push(`${backups.map((organization) => organization.organizationName).join(", ")} ${backups.length === 1 ? "is a" : "are"} backup candidate${backups.length === 1 ? "" : "s"}.`)
  }
  if (lowerPriority.length > 0) {
    parts.push(
      `${lowerPriority.map((organization) => organization.organizationName).join(", ")} ${lowerPriority.length === 1 ? "is" : "are"} lower priority in this overlap group.`,
    )
  }

  return parts.join(" ")
}

function broadPortfolioAreaPriority(area: BroadPortfolioArea): number {
  if (area === "Animals") return 4
  if (area === "Medical") return 3
  if (area === "Human Services" || area === "Veterans") return 2
  if (area === "Environment") return 1
  return 0
}

function deriveClientSuggestedAction(organization: PortfolioConcentrationOrganization): ClientSuggestedAction {
  if (organization.portfolioRole === "Phase Out Candidate") {
    if (organization.recommendation === "Reduce") return "Consider reducing"
    return "Consider pausing"
  }
  if (organization.portfolioRole === "Review Before Core") return "Review before final list"
  if (
    organization.portfolioRole === "Overlapping / Lower Priority" ||
    organization.portfolioRole === "Backup Candidate"
  ) {
    return "Similar to stronger charity"
  }
  if (organization.portfolioRole === "Core Pick") return "Keep in final list"
  return "Strong candidate"
}

function deriveWhyItMadeTheList(organization: PortfolioConcentrationOrganization): string {
  if (organization.portfolioRole === "Core Pick") {
    return `Strongest verified choice in ${organization.overlapGroupLabel}.`
  }
  if (organization.portfolioRole === "Category Leader") {
    return `Top-rated charity in ${organization.overlapGroupLabel} among similar organizations.`
  }
  if (organization.portfolioRole === "Unique Mission") {
    if (organization.groupingStatus === "needs_manual_review") {
      return "Covers a distinct mission area — confirm grouping before finalizing."
    }
    return `Only charity in ${organization.overlapGroupLabel}, so it fills a unique portfolio spot.`
  }
  if (organization.portfolioRole === "Review Before Core") {
    return "Strong overall, but open questions remain before confidently adding to the final list."
  }
  return `Recommended representative for ${organization.overlapGroupLabel}.`
}

function buildClientConcern(organization: PortfolioConcentrationOrganization): string {
  const concerns: string[] = []
  if (organization.watchdogReviewRequired) concerns.push("Watchdog review recommended")
  if (organization.advocacyReviewStatus === "donor_comfort_review") {
    concerns.push("Advocacy activity needs a donor comfort review")
  }
  if (organization.advocacyReviewStatus === "partisan_red_flag") {
    concerns.push("Partisan political activity flagged for review")
  }
  if (organization.advocacyReviewStatus === "notes_missing") {
    concerns.push("Advocacy notes still missing")
  }
  if (organization.rankingStatus !== "Research Complete") concerns.push("Research is not complete yet")
  if (organization.legalVerificationStatus !== "Verified") {
    concerns.push(`Legal status: ${organization.legalVerificationStatus}`)
  }
  if (organization.financialCompletenessStatus !== "complete") {
    concerns.push("Financial details are incomplete")
  }
  if (organization.impactEvidenceLevel === "Not comparable / insufficient evidence") {
    concerns.push("Impact evidence is not comparable or insufficient")
  }
  if (organization.impactEvidenceLevel === "Limited impact evidence") {
    concerns.push("Impact evidence is limited")
  }
  if (organization.groupingStatus === "needs_manual_review") {
    concerns.push("Mission grouping needs Mika review")
  }
  return concerns.join(". ") || "Needs review before final decision"
}

function buildClientNextStep(organization: PortfolioConcentrationOrganization): string {
  if (organization.groupingStatus === "needs_manual_review") {
    return "Confirm which similar charities belong together, then compare again."
  }
  if (organization.watchdogReviewRequired) {
    return "Review CharityWatch or watchdog notes on the organization detail page."
  }
  if (organization.advocacyReviewStatus === "donor_comfort_review" || organization.advocacyReviewStatus === "notes_missing") {
    return "Read advocacy notes and confirm you are comfortable with the organization's policy work."
  }
  if (organization.rankingStatus !== "Research Complete") {
    return "Finish research and confirm financial details before adding to the final list."
  }
  if (organization.financialCompletenessStatus !== "complete") {
    return "Add or confirm program, admin, and fundraising percentages before finalizing."
  }
  if (organization.legalVerificationStatus !== "Verified") {
    return "Confirm legal and tax status before making this a core charity."
  }
  if (organization.impactEvidenceLevel === "Not comparable / insufficient evidence") {
    return "Gather clearer impact information or compare with a better-documented peer."
  }
  return "Resolve the open items above, then reconsider for the final list."
}

function isReviewBeforeFinalCandidate(organization: PortfolioConcentrationOrganization): boolean {
  if (organization.portfolioRole === "Review Before Core") return true
  if (
    organization.groupingStatus === "needs_manual_review" &&
    organization.stewardshipScore >= RECOMMENDATION_THRESHOLDS.keepScoreMin
  ) {
    return true
  }
  return false
}

function buildSuggestedFinalList(
  suggestedCorePortfolio: PortfolioConcentrationOrganization[],
): PortfolioConcentrationClientCharity[] {
  return suggestedCorePortfolio.map((organization) => ({
    id: organization.id,
    organizationName: organization.organizationName,
    area: organization.overlapGroupLabel,
    whyItMadeTheList: deriveWhyItMadeTheList(organization),
    currentGift: organization.approximateAnnualDonation,
    suggestedAction: deriveClientSuggestedAction(organization),
  }))
}

function buildReviewBeforeFinalDecision(
  organizations: PortfolioConcentrationOrganization[],
): PortfolioConcentrationReviewItem[] {
  return organizations
    .filter(isReviewBeforeFinalCandidate)
    .sort((left, right) => right.stewardshipScore - left.stewardshipScore)
    .map((organization) => ({
      id: organization.id,
      organizationName: organization.organizationName,
      concern: buildClientConcern(organization),
      nextStep: buildClientNextStep(organization),
    }))
}

function isImportantOverlapGroup(group: PortfolioConcentrationGroup): boolean {
  if (group.organizationCount > 1) return true
  if (group.needsReview) return true
  if (group.organizations.some((organization) => organization.approximateAnnualDonation > 0)) return true
  return group.organizations.some(
    (organization) =>
      organization.portfolioRole === "Overlapping / Lower Priority" ||
      organization.portfolioRole === "Phase Out Candidate" ||
      organization.portfolioRole === "Backup Candidate" ||
      organization.portfolioRole === "Review Before Core",
  )
}

function buildImportantOverlapGroups(groups: PortfolioConcentrationGroup[]): PortfolioConcentrationOverlapSummary[] {
  return groups
    .filter(isImportantOverlapGroup)
    .sort((left, right) => {
      const leftGiving = left.organizations.reduce((sum, organization) => sum + organization.approximateAnnualDonation, 0)
      const rightGiving = right.organizations.reduce((sum, organization) => sum + organization.approximateAnnualDonation, 0)
      if (rightGiving !== leftGiving) return rightGiving - leftGiving
      return right.organizationCount - left.organizationCount
    })
    .map((group) => {
      const leader =
        group.organizations.find((organization) => organization.groupRank === 1) ??
        group.organizations.find((organization) => organization.portfolioRole === "Core Pick") ??
        null
      const similar = group.organizations.filter(
        (organization) =>
          organization.id !== leader?.id &&
          (organization.portfolioRole === "Overlapping / Lower Priority" ||
            organization.portfolioRole === "Backup Candidate" ||
            organization.portfolioRole === "Phase Out Candidate" ||
            organization.portfolioRole === "Review Before Core"),
      )
      const totalKnownGiving = group.organizations.reduce(
        (sum, organization) => sum + organization.approximateAnnualDonation,
        0,
      )
      const bestName = leader?.organizationName ?? group.suggestedCorePickName ?? group.categoryLeaderName
      let suggestedDecision = `Keep one main charity in ${group.overlapGroupLabel} unless there is a personal reason to support more than one.`
      if (group.organizationCount === 1) {
        suggestedDecision = `${group.overlapGroupLabel} currently has one charity in the portfolio.`
      } else if (similar.some((organization) => organization.portfolioRole === "Phase Out Candidate")) {
        suggestedDecision = `Consider focusing giving on ${bestName ?? "the top choice"} and reducing or pausing similar charities in this area.`
      }

      return {
        overlapGroupLabel: group.overlapGroupLabel,
        bestCurrentPick: bestName,
        similarCharitiesToReview: similar.map((organization) => organization.organizationName),
        suggestedDecision,
        totalKnownGiving,
      }
    })
}

function computeGivingTotals(organizations: Organization[]) {
  let totalKnownAnnualGiving = 0
  let missingGiftAmountCount = 0
  for (const organization of organizations) {
    const gift = Math.round(organization.approximateAnnualDonation)
    if (gift > 0) totalKnownAnnualGiving += gift
    else missingGiftAmountCount += 1
  }
  return { totalKnownAnnualGiving, missingGiftAmountCount }
}

function buildSuggestedCorePortfolio(allOrganizations: PortfolioConcentrationOrganization[]): PortfolioConcentrationOrganization[] {
  const suggested: PortfolioConcentrationOrganization[] = []
  const usedGroupKeys = new Set<string>()
  const bucketCounts = new Map<string, number>()

  const isExcluded = (organization: PortfolioConcentrationOrganization) =>
    organization.portfolioRole === "Phase Out Candidate" ||
    organization.legalVerificationStatus === "Failed Verification" ||
    organization.recommendation === "Pause / Do Not Fund" ||
    organization.groupingStatus === "needs_manual_review"

  const isPrimaryCandidate = (organization: PortfolioConcentrationOrganization) =>
    organization.portfolioRole === "Core Pick" ||
    organization.portfolioRole === "Category Leader" ||
    organization.portfolioRole === "Unique Mission"

  const candidates = [...allOrganizations]
    .filter((organization) => !isExcluded(organization))
    .sort((left, right) => {
      const areaDiff = broadPortfolioAreaPriority(right.broadPortfolioArea) - broadPortfolioAreaPriority(left.broadPortfolioArea)
      if (areaDiff !== 0) return areaDiff
      const roleScore = (role: PortfolioRole) => {
        if (role === "Core Pick") return 5
        if (role === "Category Leader") return 4
        if (role === "Unique Mission") return 3
        if (role === "Review Before Core") return 2
        if (role === "Backup Candidate") return 1
        return 0
      }
      const roleDiff = roleScore(right.portfolioRole) - roleScore(left.portfolioRole)
      if (roleDiff !== 0) return roleDiff
      return right.stewardshipScore - left.stewardshipScore
    })

  for (const organization of candidates) {
    if (suggested.length >= FINAL_PORTFOLIO_TARGET_MAX) break
    if (!isPrimaryCandidate(organization)) continue
    if (organization.portfolioRole === "Review Before Core") continue
    if (usedGroupKeys.has(organization.overlapGroupKey)) continue

    const bucketCount = bucketCounts.get(organization.missionBucket) ?? 0
    if (bucketCount >= MAX_CORE_PER_MISSION_BUCKET) continue

    suggested.push(organization)
    usedGroupKeys.add(organization.overlapGroupKey)
    bucketCounts.set(organization.missionBucket, bucketCount + 1)
  }

  if (suggested.length < FINAL_PORTFOLIO_TARGET_MIN) {
    for (const organization of candidates) {
      if (suggested.length >= FINAL_PORTFOLIO_TARGET_MIN) break
      if (suggested.some((item) => item.id === organization.id)) continue
      if (organization.portfolioRole === "Phase Out Candidate") continue
      if (organization.portfolioRole === "Overlapping / Lower Priority") continue
      if (organization.groupingStatus === "needs_manual_review") continue
      if (usedGroupKeys.has(organization.overlapGroupKey) && organization.portfolioRole === "Backup Candidate") continue
      suggested.push(organization)
      usedGroupKeys.add(organization.overlapGroupKey)
    }
  }

  return suggested.slice(0, FINAL_PORTFOLIO_TARGET_MAX)
}

export function buildPortfolioConcentration(organizations: Organization[]): PortfolioConcentrationResponse {
  const grouped = new Map<
    string,
    { label: string; classification: OverlapClassification; organizations: Organization[] }
  >()

  for (const organization of organizations) {
    const classification = classifyOrganizationOverlap(organization)
    const existing = grouped.get(classification.overlapGroupKey) ?? {
      label: classification.overlapGroupLabel,
      classification,
      organizations: [],
    }
    existing.organizations.push(organization)
    grouped.set(classification.overlapGroupKey, existing)
  }

  const overlapGroups: PortfolioConcentrationGroup[] = []
  const allConcentrationOrganizations: PortfolioConcentrationOrganization[] = []

  for (const [overlapGroupKey, groupData] of grouped.entries()) {
    const sortedOrganizations = [...groupData.organizations].sort(compareOrganizationsInGroup)
    const groupSize = sortedOrganizations.length
    const groupOrganizations = sortedOrganizations.map((organization, index) => {
      const classification = classifyOrganizationOverlap(organization)
      const groupRank = index + 1
      const { portfolioRole, roleReason } = assignPortfolioRole(
        organization,
        groupRank,
        groupSize,
        classification.groupingStatus,
      )
      return toConcentrationOrganization(
        organization,
        classification,
        groupRank,
        groupSize,
        portfolioRole,
        roleReason,
      )
    })

    allConcentrationOrganizations.push(...groupOrganizations)

    const leader = groupOrganizations[0] ?? null
    const needsReview =
      groupData.classification.groupingStatus === "needs_manual_review" ||
      groupOrganizations.some(
        (organization) =>
          organization.portfolioRole === "Review Before Core" ||
          organization.portfolioRole === "Phase Out Candidate" ||
          organization.watchdogReviewRequired ||
          organization.advocacyReviewStatus === "donor_comfort_review",
      )

    overlapGroups.push({
      overlapGroupKey,
      overlapGroupLabel: groupData.label,
      broadPortfolioArea: groupData.classification.broadPortfolioArea,
      speciesFocus: groupData.classification.speciesFocus,
      interventionType: groupData.classification.interventionType,
      organizationCount: groupSize,
      categoryLeaderId: leader?.id ?? null,
      categoryLeaderName: leader?.organizationName ?? null,
      suggestedCorePickId:
        groupOrganizations.find((organization) => organization.portfolioRole === "Core Pick")?.id ?? null,
      suggestedCorePickName:
        groupOrganizations.find((organization) => organization.portfolioRole === "Core Pick")?.organizationName ?? null,
      suggestedDecisionSummary: buildGroupDecisionSummary(groupData.label, groupOrganizations),
      needsReview,
      organizations: groupOrganizations,
    })
  }

  overlapGroups.sort((left, right) => left.overlapGroupLabel.localeCompare(right.overlapGroupLabel))

  const suggestedCorePortfolio = buildSuggestedCorePortfolio(allConcentrationOrganizations)
  const groupsNeedingReview = overlapGroups.filter((group) => group.needsReview)
  const overlappingOrganizations = allConcentrationOrganizations.filter(
    (organization) =>
      organization.portfolioRole === "Overlapping / Lower Priority" || organization.portfolioRole === "Backup Candidate",
  )
  const phaseOutCandidates = allConcentrationOrganizations.filter(
    (organization) => organization.portfolioRole === "Phase Out Candidate",
  )
  const needsManualGroupingReview = allConcentrationOrganizations.filter(
    (organization) => organization.groupingStatus === "needs_manual_review",
  )
  const qualifiedCoreCandidateCount = allConcentrationOrganizations.filter(
    (organization) => organization.portfolioRole === "Core Pick",
  ).length
  const suggestedFinalListCount = suggestedCorePortfolio.length
  const suggestedFinalList = buildSuggestedFinalList(suggestedCorePortfolio)
  const reviewBeforeFinalDecision = buildReviewBeforeFinalDecision(allConcentrationOrganizations)
  const importantOverlapGroups = buildImportantOverlapGroups(overlapGroups)
  const { totalKnownAnnualGiving, missingGiftAmountCount } = computeGivingTotals(organizations)
  const suggestedCoreKnownAnnualGiving = suggestedCorePortfolio.reduce(
    (sum, organization) => sum + organization.approximateAnnualDonation,
    0,
  )

  const summary: PortfolioConcentrationSummary = {
    finalPortfolioTargetMin: FINAL_PORTFOLIO_TARGET_MIN,
    finalPortfolioTargetMax: FINAL_PORTFOLIO_TARGET_MAX,
    totalOrganizationsReviewed: organizations.length,
    recommendedCorePickCount: qualifiedCoreCandidateCount,
    groupsWithCategoryLeaderCount: overlapGroups.filter((group) => group.categoryLeaderId).length,
    groupsNeedingReviewCount: groupsNeedingReview.length,
    overlappingLowerPriorityCount: allConcentrationOrganizations.filter(
      (organization) => organization.portfolioRole === "Overlapping / Lower Priority",
    ).length,
    phaseOutCandidateCount: phaseOutCandidates.length,
    needsManualGroupingReviewCount: needsManualGroupingReview.length,
    suggestedCorePortfolioCount: suggestedFinalListCount,
    headline: `Suggested core portfolio: ${suggestedFinalListCount} charities across ${overlapGroups.length} overlap groups (target ${FINAL_PORTFOLIO_TARGET_MIN}–${FINAL_PORTFOLIO_TARGET_MAX}).`,
    guidance:
      "This is a decision-support view — not an automatic final list. Prefer one strong representative per specific overlap group, keep unique missions, and resolve review flags before promoting charities to core status.",
    totalKnownAnnualGiving,
    suggestedCoreKnownAnnualGiving,
    missingGiftAmountCount,
    qualifiedCoreCandidateCount,
    suggestedFinalListCount,
    reviewBeforeFinalCount: reviewBeforeFinalDecision.length,
    clientHeadline: `Suggested final list: ${suggestedFinalListCount} ${suggestedFinalListCount === 1 ? "charity" : "charities"}`,
    clientSubheadline:
      "This is a decision-support shortlist. It keeps the strongest charities across different mission areas and avoids spreading donations across too many similar organizations.",
    qualifiedVsSuggestedNote:
      qualifiedCoreCandidateCount > suggestedFinalListCount
        ? `${qualifiedCoreCandidateCount} charities fully qualify as core candidates, but the suggested final list shows ${suggestedFinalListCount} to stay within the ${FINAL_PORTFOLIO_TARGET_MIN}–${FINAL_PORTFOLIO_TARGET_MAX} target and avoid duplicate mission areas.`
        : `${qualifiedCoreCandidateCount} ${qualifiedCoreCandidateCount === 1 ? "charity qualifies" : "charities qualify"} as a core candidate for the final list.`,
  }

  return {
    summary,
    overlapGroups,
    suggestedCorePortfolio,
    suggestedFinalList,
    reviewBeforeFinalDecision,
    importantOverlapGroups,
    groupsNeedingReview,
    overlappingOrganizations,
    phaseOutCandidates,
    needsManualGroupingReview,
  }
}
