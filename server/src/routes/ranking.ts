import { Router } from "express"
import {
  CHARITY_NAVIGATOR_API_URL,
  isCharityNavigatorConfigured,
} from "../config/watchdog-config.js"
import {
  DEFAULT_LEGACY_MISSION_ALLOCATION,
  GIVING_PLAN_LIMITS,
  LEGACY_RULES,
  MISSION_BUCKETS,
  RANKING_MODEL_VERSION,
  RANKING_STATUSES,
  RECOMMENDATION_THRESHOLDS,
  STEWARDSHIP_WEIGHTS,
  TRIAGE_RESEARCH_CHECKLIST,
} from "../config/ranking-config.js"
import { getOrganizations } from "../services/data-store-service.js"
import { buildPortfolioConcentration } from "../services/portfolio-concentration-service.js"
import { buildPortfolioReview } from "../services/portfolio-review-service.js"
import { getScoreSpreadCheck } from "../services/ranking-service.js"
import {
  resolvePreliminaryStewardshipScore,
  resolveVerifiedStewardshipScore,
} from "../services/stewardship-score-fields.js"
import { getWatchdogCatalogStats } from "../services/watchdog-catalog-service.js"
import type { Organization } from "../types/organization.js"

export function rankingRouter(): Router {
  const router = Router()

  router.get("/explanation", (_request, response) => {
    response.json({
      modelVersion: RANKING_MODEL_VERSION,
      legalVerificationRule:
        "Legal verification is a gate before ranking: Verified, Needs Review, Failed Verification, or Insufficient Data. Failed verification or serious identity problems prevent positive recommendations.",
      stewardshipWeights: {
        financialEfficiency: STEWARDSHIP_WEIGHTS.financialEfficiency,
        accountability: STEWARDSHIP_WEIGHTS.accountability,
        governance: STEWARDSHIP_WEIGHTS.governance,
        missionFit: STEWARDSHIP_WEIGHTS.missionFit,
      },
      stewardshipScoreRule:
        "The Stewardship Score (0–100) combines financial efficiency 35%, accountability 35%, governance hygiene 20%, and mission fit 10% when financial data is complete. Impact evidence and political activity do not change this score. List rank is based on stewardship.",
      financialCompletenessRule:
        "All three verified ratios (program, fundraising, admin) are required for the financial component. If financials are missing or partial, that component is excluded and the remaining stewardship categories are renormalized. An asterisk on the score means financials were excluded.",
      impactEvidenceRule:
        "Impact evidence level (Strong, Basic, Limited, or Not comparable) is a separate label reflecting documentation quality. It is not part of the stewardship score. Priority Fund requires impact at least Basic.",
      watchdogReviewRule:
        "Poor CharityWatch grades (D/F) or Charity Navigator ratings (1–2 stars) trigger watchdog review, penalize accountability, and can cap recommendations at Review Before Donating.",
      politicalReviewRule:
        "Advocacy review uses a status label (none documented, nonpartisan documented, notes missing, not reviewed, donor comfort review, or partisan activity review). Only donor comfort review and partisan activity review cap recommendations. Missing or unreviewed advocacy notes affect confidence and triage but do not automatically cap high-stewardship organizations.",
      recommendationRule:
        "Pause for failed legal verification or serious red flags. Review for legal needs review, low confidence, watchdog, or advocacy flags. Keep requires strong stewardship without requiring high impact. Priority Fund requires strong stewardship, high confidence, and impact at least Basic.",
      confidenceRule:
        "Confidence blends field completeness (70%) and source quality (30%), then adjusts for missing financials, legal status, weak impact comparability, bad watchdog signals, and failed research. Shown as High, Medium, or Low.",
      rankingStatusRule:
        "Research status (Preliminary, Research Partial, or Research Complete) reflects data completeness and is separate from legal verification and impact evidence level. Research Complete requires core identity, complete financial ratios, and confidence 85%+.",
      personalizedRankRule:
        "Objective rank is the default. Personalized rank adds a small capped donor-confidence boost from prior giving to the stewardship score — it does not change stewardship components.",
      legacyRule:
        `Legacy eligibility requires verified stewardship ${LEGACY_RULES.stewardshipScoreMin}+, confidence ${LEGACY_RULES.confidenceMin}%+, impact at least Basic, accountability ${LEGACY_RULES.accountabilityMin}/100+, and no red flags. Legacy Core is limited to top candidates per mission list.`,
      donationAssessmentRule:
        "Gift size review is separate from the stewardship score: current annual donation helps decide whether to keep, reduce, pause, or stay small until verified.",
      categoryListRule:
        "Organizations are ranked within mission-bucket lists (mission area plus subcategory when available). Each list compares similar charities only. An all-organizations view is also available for portfolio-wide comparison.",
    })
  })

  router.get("/lists", async (_request, response) => {
    const organizations = await getOrganizations()
    const listMap = new Map<string, { key: string; label: string; organizationCount: number }>()
    for (const organization of organizations) {
      const existing = listMap.get(organization.rankingListKey)
      if (existing) {
        existing.organizationCount += 1
      } else {
        listMap.set(organization.rankingListKey, {
          key: organization.rankingListKey,
          label: organization.rankingListLabel,
          organizationCount: 1,
        })
      }
    }
    const lists = Array.from(listMap.values()).sort((left, right) => {
      if (right.organizationCount !== left.organizationCount) {
        return right.organizationCount - left.organizationCount
      }
      return left.label.localeCompare(right.label)
    })
    response.json({ lists })
  })

  router.get("/top", async (request, response) => {
    const limit = Number.parseInt(String(request.query.limit ?? "10"), 10)
    const organizations = await getOrganizations()
    response.json({ organizations: organizations.slice(0, Math.max(1, limit)) })
  })

  router.get("/triage", async (request, response) => {
    const limit = Number.parseInt(String(request.query.limit ?? "20"), 10)
    const organizations = await getOrganizations()

    function getTriagePriorityReasons(organization: (typeof organizations)[number]): string[] {
      const reasons: string[] = []
      const score = organization.scoreBreakdown
      if (!score) return reasons

      const highDonationLowConfidence =
        organization.approximateAnnualDonation >= 250 && score.confidenceScore < 70 && score.preliminaryStewardshipScore >= 55
      const possibleLegacyMissingFields =
        resolveVerifiedStewardshipScore(score) >= 75 && score.confidenceScore < 85 && score.missingFields.length > 0
      const lowScoreMeaningfulMoney = resolveVerifiedStewardshipScore(score) < 55 && organization.approximateAnnualDonation >= 150
      const priorityCauseMissingAccountability =
        (score.missionBucket === "Farm Animal Welfare" ||
          score.missionBucket === "Animal Rescue / Shelters" ||
          score.missionBucket === "Wildlife / Conservation") &&
        (score.missingFields.includes("ein") || score.missingFields.includes("is501c3Verified") || score.accountabilityScore < 60 || score.financialEfficiencyStatus === "unknown")
      const politicalUncertainty = score.politicalRiskScore < 60 || score.politicalInvolvementNotes.toLowerCase().includes("unclear")
      const unclearLegalIdentity = score.missingFields.includes("ein") || score.missingFields.includes("is501c3Verified")
      const missingFinancialRatios = score.financialEfficiencyStatus === "unknown"

      if (highDonationLowConfidence) reasons.push("High annual donation with low confidence")
      if (possibleLegacyMissingFields) reasons.push("Possible legacy candidate still missing fields")
      if (lowScoreMeaningfulMoney) reasons.push("Lower score while receiving meaningful donations")
      if (priorityCauseMissingAccountability) reasons.push("Priority animal cause has accountability gaps")
      if (politicalUncertainty) reasons.push("Political or advocacy involvement is unclear")
      if (unclearLegalIdentity) reasons.push("Legal identity is unclear and needs verification")
      if (missingFinancialRatios) reasons.push("Financial ratios are missing")
      return reasons
    }

    const triageQueue = organizations
      .filter((organization) => {
        if (!organization.scoreBreakdown) return false
        const score = organization.scoreBreakdown
        const isWellResearchedHighConfidence = score.confidenceScore >= 85 && score.rankingStatus === "Research Complete"
        if (isWellResearchedHighConfidence) return false
        return getTriagePriorityReasons(organization).length > 0
      })
      .map((organization) => {
        const reasons = getTriagePriorityReasons(organization)
        const score = organization.scoreBreakdown
        const highDonationLowConfidenceScore =
          organization.approximateAnnualDonation >= 250 ? Math.max(0, 85 - (score?.confidenceScore ?? 0)) : 0
        const baselineScore = resolveVerifiedStewardshipScore(score ?? {})
        const legacyGapScore = baselineScore >= 75 ? (score?.missingFields.length ?? 0) * 12 : 0
        const lowScoreMeaningfulMoneyScore =
          baselineScore < 55 && organization.approximateAnnualDonation >= 150 ? 35 : 0
        const accountabilityGapScore =
          (score?.missionBucket === "Farm Animal Welfare" ||
            score?.missionBucket === "Animal Rescue / Shelters" ||
            score?.missionBucket === "Wildlife / Conservation") &&
          ((score?.accountabilityScore ?? 100) < 60)
            ? 25
            : 0
        const politicalUncertaintyScore =
          (score?.politicalRiskScore ?? 100) < 60 || (score?.politicalInvolvementNotes ?? "").toLowerCase().includes("unclear")
            ? 20
            : 0

        return {
          id: organization.id,
          organizationName: organization.organizationName,
          confidenceScore: organization.scoreBreakdown?.confidenceScore ?? 0,
          stewardshipScore: baselineScore,
          approximateAnnualDonation: organization.approximateAnnualDonation,
          missingFieldsCount: organization.scoreBreakdown?.missingFields.length ?? 0,
          recommendation: organization.scoreBreakdown?.recommendation ?? "Review Before Donating",
          nextAction: organization.scoreBreakdown?.nextAction ?? "Review record manually.",
          priorityReasons: reasons,
          researchChecklist: TRIAGE_RESEARCH_CHECKLIST.filter((task) => {
            const scoreData = organization.scoreBreakdown
            if (!scoreData) return false
            if (task === "Find EIN") return scoreData.missingFields.includes("ein")
            if (task === "Verify 501(c)(3)") return scoreData.missingFields.includes("is501c3Verified")
            if (task === "Find Form 990") return scoreData.financialEfficiencyStatus === "unknown"
            if (task === "Find program/fundraising/admin percentages") return scoreData.financialEfficiencyStatus === "unknown"
            if (task === "Check Charity Navigator") return scoreData.missingFields.includes("charityNavigatorRating")
            if (task === "Check annual report or impact report") return !scoreData.impactEvidenceNotes
            if (task === "Check political/lobbying/advocacy involvement") return !scoreData.politicalInvolvementNotes
            return true
          }),
          triagePriority: Math.round(
            highDonationLowConfidenceScore +
              legacyGapScore +
              lowScoreMeaningfulMoneyScore +
              accountabilityGapScore +
              politicalUncertaintyScore,
          ),
        }
      })
      .sort((left, right) => right.triagePriority - left.triagePriority)
      .slice(0, Math.max(1, limit))

    response.json({ triageQueue })
  })

  router.get("/portfolio-review", async (_request, response) => {
    const organizations = await getOrganizations()
    response.json(buildPortfolioReview(organizations))
  })

  router.get("/portfolio-concentration", async (_request, response) => {
    const organizations = await getOrganizations()
    response.json(buildPortfolioConcentration(organizations))
  })

  router.get("/giving-plan", async (_request, response) => {
    const organizations = await getOrganizations()
    const groups = MISSION_BUCKETS.map((missionBucket) => {
      const bucketOrganizations = organizations.filter((organization) => organization.missionBucket === missionBucket)
      const totalCurrentAnnualDonations = bucketOrganizations.reduce(
        (sum, organization) => sum + organization.approximateAnnualDonation,
        0,
      )
      const topRecommended = bucketOrganizations
        .filter(
          (organization) =>
            ["Priority Fund", "Keep"].includes(organization.recommendation) && organization.rankingStatus === "Research Complete",
        )
        .sort(
          (left, right) => resolveVerifiedStewardshipScore(right) - resolveVerifiedStewardshipScore(left),
        )
        .slice(0, GIVING_PLAN_LIMITS.maxTopRecommendedPerBucket)
      const promisingUnverified = bucketOrganizations
        .filter(
          (organization) =>
            ["Preliminary", "Research Partial"].includes(organization.rankingStatus) &&
            resolvePreliminaryStewardshipScore(organization) >= 65,
        )
        .slice(0, 6)
      const reduceOrPause = bucketOrganizations.filter((organization) =>
        ["Reduce", "Pause / Do Not Fund"].includes(organization.recommendation),
      )
      const suggestedKeepCount = Math.min(GIVING_PLAN_LIMITS.maxTopRecommendedPerBucket, Math.max(2, topRecommended.length || 1))

      return {
        missionBucket,
        totalCurrentAnnualDonations: Math.round(totalCurrentAnnualDonations),
        organizationCount: bucketOrganizations.length,
        suggestedKeepCount,
        topRecommended,
        promisingUnverified,
        reduceOrPause,
        consolidationReason:
          bucketOrganizations.length <= suggestedKeepCount
            ? "This bucket is already compact."
            : `Focus on about ${suggestedKeepCount} stronger organizations to avoid spreading gifts too thin.`,
      }
    }).filter((group) => group.organizationCount > 0)

    response.json({ groups })
  })

  router.get("/legacy-plan", async (_request, response) => {
    const organizations = await getOrganizations()
    const eligibleOrganizations = organizations.filter(
      (organization) =>
        organization.legacyEligible &&
        organization.rankingStatus === "Research Complete" &&
        organization.verifiedStewardshipScore !== null &&
        organization.verifiedStewardshipScore >= LEGACY_RULES.stewardshipScoreMin &&
        organization.confidenceScore >= LEGACY_RULES.confidenceMin,
    )
    const excludedOrganizations = organizations
      .filter((organization) => !organization.legacyEligible)
      .map((organization) => ({
        id: organization.id,
        organizationName: organization.organizationName,
        missionBucket: organization.missionBucket,
        reason: organization.legacyExclusionReason ?? organization.legacyRationale,
      }))

    const organizationsByArea = Object.keys(DEFAULT_LEGACY_MISSION_ALLOCATION).map((missionArea) => {
      const areaOrganizations = eligibleOrganizations
        .filter((organization) => organization.missionBucket === missionArea)
        .sort((left, right) => right.stewardshipScore - left.stewardshipScore)
      return {
        missionArea,
        defaultAllocationPercent:
          DEFAULT_LEGACY_MISSION_ALLOCATION[missionArea as keyof typeof DEFAULT_LEGACY_MISSION_ALLOCATION],
        organizations: areaOrganizations.slice(0, 6),
      }
    })

    response.json({
      allocationDefaults: DEFAULT_LEGACY_MISSION_ALLOCATION,
      legacyRules: [
        `Legacy requires verified stewardship ${LEGACY_RULES.stewardshipScoreMin}+, confidence ${LEGACY_RULES.confidenceMin}%+, impact at least Basic, and accountability ${LEGACY_RULES.accountabilityMin}/100.`,
        "Legacy Core is limited to top candidates within each mission list. Local/small orgs are capped at Legacy Backup.",
        "Avoid legacy gifts for organizations with red flags or unresolved legal identity.",
      ],
      organizationsByArea,
      excludedOrganizations,
    })
  })

  router.get("/watchdog-setup", (_request, response) => {
    const catalogStats = getWatchdogCatalogStats()
    response.json({
      charityNavigator: {
        configured: isCharityNavigatorConfigured(),
        apiUrl: CHARITY_NAVIGATOR_API_URL,
        setupUrl: "https://developer.charitynavigator.org/",
        instructions:
          "Register for a free API key, add CHARITY_NAVIGATOR_API_KEY to server/.env, restart the API server, then run Research all organizations.",
      },
      charityWatch: {
        configured: catalogStats.charityWatchEntryCount > 0,
        entryCount: catalogStats.charityWatchEntryCount,
        updatedAt: catalogStats.charityWatchUpdatedAt,
        setupUrl: "https://www.charitywatch.org/",
        instructions:
          "CharityWatch blocks automated scraping. Add grades manually to server/data/charitywatch-ratings.json, then run Research all organizations.",
      },
      ace: {
        configured: catalogStats.aceRecommendedCount + catalogStats.aceStandoutCount > 0,
        recommendedCount: catalogStats.aceRecommendedCount,
        standoutCount: catalogStats.aceStandoutCount,
        updatedAt: catalogStats.aceUpdatedAt,
        setupUrl: "https://animalcharityevaluators.org/recommended-charities/",
        instructions:
          "ACE has no public API. Keep server/data/ace-recommended-charities.json updated with ACE recommended charities, then run Research all organizations.",
      },
    })
  })

  router.get("/research-audit", async (_request, response) => {
    const organizations = await getOrganizations()
    const totalOrganizations = organizations.length
    const hasSourceType = (organization: Organization, sourceTypeText: string): boolean =>
      Object.values(organization.sourceMeta ?? {}).some((source) => (source.sourceType ?? source.sourceName).includes(sourceTypeText))

    const stats = {
      totalOrganizations,
      verifiedEinCount: organizations.filter((organization) => Boolean(organization.ein)).length,
      verified501c3Count: organizations.filter(
        (organization) => organization.is501c3Verified.toLowerCase() === "y",
      ).length,
      financialRatiosCount: organizations.filter(
        (organization) =>
          organization.programPercent !== null && organization.fundraisingPercent !== null && organization.adminPercent !== null,
      ).length,
      charityNavigatorCount: organizations.filter((organization) => organization.charityNavigatorRating !== null).length,
      charityWatchCount: organizations.filter((organization) => Boolean(organization.charityWatchGrade)).length,
      aceRecommendationCount: organizations.filter((organization) => Boolean(organization.aceRecommendation)).length,
      candidGuideStarCount: organizations.filter((organization) => hasSourceType(organization, "Candid/GuideStar")).length,
      proPublicaForm990Count: organizations.filter((organization) => hasSourceType(organization, "ProPublica/Form 990")).length,
      politicalNotesCount: organizations.filter((organization) => Boolean(organization.politicalInvolvementNotes.trim())).length,
      impactEvidenceNotesCount: organizations.filter((organization) => Boolean(organization.impactEvidenceNotes.trim())).length,
      verifiedRankingCount: organizations.filter((organization) => organization.rankingStatus === "Research Complete").length,
      preliminaryCount: organizations.filter((organization) => organization.rankingStatus === "Preliminary").length,
    }

    const spreadCheck = getScoreSpreadCheck(organizations)
    const rankingStatusCounts = Object.fromEntries(
      RANKING_STATUSES.map((status) => [
        status,
        organizations.filter((organization) => organization.rankingStatus === status).length,
      ]),
    ) as Record<(typeof RANKING_STATUSES)[number], number>

    response.json({
      stats,
      spreadCheck,
      rankingStatusCounts,
      message: spreadCheck.warning
        ? "Most organizations have similar stewardship scores because financial ratios or accountability data are still missing. Complete research before using list rank as a final comparison."
        : "Stewardship score spread looks reasonably differentiated.",
    })
  })

  return router
}
