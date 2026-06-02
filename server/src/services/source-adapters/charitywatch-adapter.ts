import { CHARITYWATCH_GRADE_SCORES } from "../../config/watchdog-config.js"
import type { Organization, SourceMeta } from "../../types/organization.js"
import { findCharityWatchEntry } from "../watchdog-catalog-service.js"
import type { ResearchAdapter, ResearchPatch } from "./adapter-types.js"

function buildSourceMeta(confidenceNote: string): SourceMeta {
  return {
    sourceName: "CharityWatch catalog",
    fetchedAt: new Date().toISOString(),
    confidenceNote,
    sourceType: "CharityWatch",
    reliability: "medium",
  }
}

export const charityWatchAdapter: ResearchAdapter = {
  sourceName: "CharityWatch",
  async enrichOrganization(organization: Organization): Promise<ResearchPatch> {
    const entry = findCharityWatchEntry(organization.organizationName, `${organization.ein ?? ""}`)
    if (!entry) {
      return {
        organizationPatch: {},
        sourceMetaPatch: {},
        changedFields: [],
        errors: [],
      }
    }

    const organizationPatch: Partial<Organization> = {}
    const sourceMetaPatch: Record<string, SourceMeta> = {}
    const changedFields: string[] = []
    const gradeScore = CHARITYWATCH_GRADE_SCORES[entry.grade.toUpperCase()] ?? null
    const existingGrade = organization.charityWatchGrade?.trim().toUpperCase() ?? ""
    const catalogGrade = entry.grade.trim().toUpperCase()

    if (existingGrade !== catalogGrade) {
      organizationPatch.charityWatchGrade = entry.grade
      sourceMetaPatch.charityWatchGrade = buildSourceMeta(
        `Grade ${entry.grade}${gradeScore !== null ? ` (${gradeScore}/100 equivalent)` : ""} from local CharityWatch catalog.`,
      )
      changedFields.push("charityWatchGrade")
    }

    if (organization.programPercent === null && entry.programPercent != null) {
      organizationPatch.programPercent = entry.programPercent
      sourceMetaPatch.programPercent = buildSourceMeta("Program percentage from CharityWatch catalog entry.")
      changedFields.push("programPercent")
    }

    if (organization.fundraisingPercent === null && entry.fundraisingPercent != null) {
      organizationPatch.fundraisingPercent = entry.fundraisingPercent
      sourceMetaPatch.fundraisingPercent = buildSourceMeta("Fundraising percentage from CharityWatch catalog entry.")
      changedFields.push("fundraisingPercent")
    }

    if (organization.adminPercent === null && entry.adminPercent != null) {
      organizationPatch.adminPercent = entry.adminPercent
      sourceMetaPatch.adminPercent = buildSourceMeta("Admin percentage from CharityWatch catalog entry.")
      changedFields.push("adminPercent")
    }

    if (!organization.accountabilityNotes.trim() && entry.notes) {
      organizationPatch.accountabilityNotes = entry.notes
      sourceMetaPatch.accountabilityNotes = buildSourceMeta("Accountability note from CharityWatch catalog entry.")
      changedFields.push("accountabilityNotes")
    }

    return {
      organizationPatch,
      sourceMetaPatch,
      changedFields,
      errors: [],
    }
  },
}
