import type {

  AdvocacyReviewStatus,

  FinancialCompletenessStatus,

  ImpactEvidenceLevel,

  LegalVerificationStatus,

  RankingStatus,

  ScoreBand,

} from "../types/organization"

import { normalizeRankingStatus } from "./ranking-label-fields"



export function formatResearchStatusLabel(status: RankingStatus | string): string {

  switch (normalizeRankingStatus(status)) {

    case "Research Complete":

      return "Research complete"

    case "Research Partial":

      return "Research partial"

    case "Preliminary":

      return "Preliminary"

    case "Not Researched":

      return "Not researched"

    case "Do Not Fund / Red Flag":

      return "Do not fund"

    default:

      return status

  }

}



export function formatLegalVerificationLabel(status: LegalVerificationStatus): string {

  switch (status) {

    case "Verified":

      return "Legal: Verified"

    case "Needs Review":

      return "Legal: Needs review"

    case "Failed Verification":

      return "Legal: Failed"

    case "Insufficient Data":

      return "Legal: Insufficient data"

    default:

      return `Legal: ${status}`

  }

}



export function formatFinancialCompletenessLabel(status: FinancialCompletenessStatus): string {

  switch (status) {

    case "complete":

      return "Financials complete"

    case "partial":

      return "Financials partial • score renormalized"

    case "missing":

      return "Financials missing • score renormalized"

    default:

      return "Financials unknown"

  }

}



export function formatImpactEvidenceLevelShort(level: ImpactEvidenceLevel): string {

  switch (level) {

    case "Strong documented impact":

      return "Impact: Strong"

    case "Basic documented impact":

      return "Impact: Basic"

    case "Limited impact evidence":

      return "Impact: Limited"

    case "Not comparable / insufficient evidence":

      return "Impact: Not comparable"

    default:

      return `Impact: ${level}`

  }

}



export function formatStewardshipBandLabel(band: ScoreBand): string {

  return band === "Insufficient Data" ? band : `${band} stewardship`

}



export function formatStewardshipScoreDisplay(score: number, band: ScoreBand, renormalized: boolean): string {

  const suffix = renormalized ? "*" : ""

  return `Stewardship ${score}${suffix}/100 • ${formatStewardshipBandLabel(band)}`

}



export function isStewardshipRenormalized(financialCompletenessStatus: FinancialCompletenessStatus): boolean {

  return financialCompletenessStatus !== "complete"

}



export function formatAdvocacyReviewLabel(status: AdvocacyReviewStatus): string {

  switch (status) {

    case "none_documented":

      return "Advocacy: none documented"

    case "nonpartisan_documented":

      return "Advocacy: nonpartisan activity documented"

    case "notes_missing":

      return "Advocacy notes missing"

    case "not_reviewed":

      return "Advocacy not reviewed"

    case "donor_comfort_review":

      return "Donor comfort review"

    case "partisan_red_flag":

      return "Partisan activity review"

    default:

      return `Advocacy: ${status}`

  }

}



export function shouldShowAdvocacyReviewChip(status: AdvocacyReviewStatus): boolean {

  return status !== "none_documented"

}



export function getAdvocacyReviewChipColor(

  status: AdvocacyReviewStatus,

): "default" | "success" | "warning" | "error" {

  if (status === "nonpartisan_documented") return "success"

  if (status === "donor_comfort_review" || status === "notes_missing" || status === "not_reviewed") return "warning"

  if (status === "partisan_red_flag") return "error"

  return "default"

}


