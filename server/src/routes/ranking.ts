import { Router } from "express"
import {
  CHARITY_NAVIGATOR_API_URL,
  isCharityNavigatorConfigured,
} from "../config/watchdog-config.js"
import {
  DEFAULT_LEGACY_MISSION_ALLOCATION,
  DONATION_WORTHINESS_WEIGHTS,
  MISSION_BUCKETS,
  RANKING_STATUSES,
  TRIAGE_RESEARCH_CHECKLIST,
} from "../config/ranking-config.js"
import { getOrganizations } from "../services/data-store-service.js"
import { getScoreSpreadCheck } from "../services/ranking-service.js"
import { getWatchdogCatalogStats } from "../services/watchdog-catalog-service.js"
import type { Organization } from "../types/organization.js"

export function rankingRouter(): Router {
  const router = Router()

  router.get("/explanation", (_request, response) => {
    response.json({
      weights: {
        impactEvidence: DONATION_WORTHINESS_WEIGHTS.impactEvidence,
        accountability: DONATION_WORTHINESS_WEIGHTS.accountability,
        financialEfficiency: DONATION_WORTHINESS_WEIGHTS.financialEfficiency,
        governance: DONATION_WORTHINESS_WEIGHTS.governance,
        politicalRisk: DONATION_WORTHINESS_WEIGHTS.politicalRisk,
      },
      scoreRule:
        "Each charity earns rubric points across five categories: legal identity (10), accountability (25), impact (30), financial efficiency (30), and political/advocacy alignment (5). Donation amount does not increase the score.",
      confidenceRule:
        "Confidence reflects how complete and verified the research is. Missing financial ratios, unclear legal identity, or stale sources lower confidence — review first, not automatic rejection.",
      donationAssessmentRule:
        "Current annual donation is reviewed separately to decide whether to keep, reduce, pause, or keep the gift small until verified.",
      legacyRule:
        "Legacy eligibility requires high score, high confidence, low risk, and verified legal/accountability foundations.",
      rankingStatusRule:
        "Ranking status is gated by confidence and red flags: Not Researched, Preliminary Only, Partially Verified, Verified Ranking, or Do Not Fund / Red Flag.",
      preliminaryVsVerifiedRule:
        "Preliminary score is shown early, but a verified score is only used when confidence is high enough for a real ranking.",
      personalizedRankRule:
        "Personalized rank adds a small, capped donor-confidence boost based on prior annual giving history. This adjusts ordering only and does not replace the objective score.",
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
        organization.approximateAnnualDonation >= 250 && score.confidenceScore < 70 && score.preliminaryScore >= 55
      const possibleLegacyMissingFields =
        (score.verifiedDonationWorthinessScore ?? score.preliminaryScore) >= 75 && score.confidenceScore < 85 && score.missingFields.length > 0
      const lowScoreMeaningfulMoney = (score.verifiedDonationWorthinessScore ?? score.preliminaryScore) < 55 && organization.approximateAnnualDonation >= 150
      const priorityCauseMissingAccountability =
        (score.missionBucket === "Farm Animal Welfare" ||
          score.missionBucket === "Animal Rescue / Shelters" ||
          score.missionBucket === "Wildlife / Conservation") &&
        (score.missingFields.includes("ein") || score.missingFields.includes("is501c3Verified") || score.accountabilityScore < 15 || score.financialEfficiencyStatus === "unknown")
      const politicalUncertainty = score.politicalRiskScore < 3 || score.politicalInvolvementNotes.toLowerCase().includes("unclear")
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
        const isWellResearchedHighConfidence = score.confidenceScore >= 85 && score.rankingStatus === "Verified Ranking"
        if (isWellResearchedHighConfidence) return false
        return getTriagePriorityReasons(organization).length > 0
      })
      .map((organization) => {
        const reasons = getTriagePriorityReasons(organization)
        const score = organization.scoreBreakdown
        const highDonationLowConfidenceScore =
          organization.approximateAnnualDonation >= 250 ? Math.max(0, 85 - (score?.confidenceScore ?? 0)) : 0
        const baselineScore = score?.verifiedDonationWorthinessScore ?? score?.preliminaryScore ?? 0
        const legacyGapScore = baselineScore >= 75 ? (score?.missingFields.length ?? 0) * 12 : 0
        const lowScoreMeaningfulMoneyScore =
          baselineScore < 55 && organization.approximateAnnualDonation >= 150 ? 35 : 0
        const accountabilityGapScore =
          (score?.missionBucket === "Farm Animal Welfare" ||
            score?.missionBucket === "Animal Rescue / Shelters" ||
            score?.missionBucket === "Wildlife / Conservation") &&
          ((score?.accountabilityScore ?? 100) < 15)
            ? 25
            : 0
        const politicalUncertaintyScore =
          (score?.politicalRiskScore ?? 100) < 3 || (score?.politicalInvolvementNotes ?? "").toLowerCase().includes("unclear")
            ? 20
            : 0

        return {
          id: organization.id,
          organizationName: organization.organizationName,
          confidenceScore: organization.scoreBreakdown?.confidenceScore ?? 0,
          donationWorthinessScore: baselineScore,
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
            ["Priority Fund", "Keep"].includes(organization.recommendation) && organization.rankingStatus === "Verified Ranking",
        )
        .sort(
          (left, right) =>
            (right.verifiedDonationWorthinessScore ?? right.preliminaryScore) -
            (left.verifiedDonationWorthinessScore ?? left.preliminaryScore),
        )
        .slice(0, 5)
      const promisingUnverified = bucketOrganizations
        .filter(
          (organization) =>
            ["Preliminary Only", "Partially Verified"].includes(organization.rankingStatus) &&
            organization.preliminaryScore >= 65,
        )
        .slice(0, 6)
      const reduceOrPause = bucketOrganizations.filter((organization) =>
        ["Reduce", "Pause / Do Not Fund"].includes(organization.recommendation),
      )
      const suggestedKeepCount = Math.min(
        Math.max(2, topRecommended.length || 1),
        Math.max(1, Math.ceil(bucketOrganizations.length * 0.35)),
      )

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
        organization.rankingStatus === "Verified Ranking" &&
        organization.verifiedDonationWorthinessScore !== null &&
        organization.verifiedDonationWorthinessScore >= 80 &&
        organization.confidenceScore >= 85,
    )
    const excludedOrganizations = organizations
      .filter((organization) => !organization.legacyEligible)
      .map((organization) => ({
        id: organization.id,
        organizationName: organization.organizationName,
        missionBucket: organization.missionBucket,
        reason: organization.legacyRationale,
      }))

    const organizationsByArea = Object.keys(DEFAULT_LEGACY_MISSION_ALLOCATION).map((missionArea) => {
      const areaOrganizations = eligibleOrganizations
        .filter((organization) => organization.missionBucket === missionArea)
        .sort((left, right) => right.donationWorthinessScore - left.donationWorthinessScore)
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
        "Keep legacy giving focused on high-scoring and high-confidence organizations.",
        "Avoid legacy gifts for organizations with serious red flags or unresolved legal identity.",
        "Use backup organizations only when a core organization no longer qualifies.",
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
      verifiedRankingCount: organizations.filter((organization) => organization.rankingStatus === "Verified Ranking").length,
      preliminaryOnlyCount: organizations.filter((organization) => organization.rankingStatus === "Preliminary Only").length,
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
        ? "Most organizations have similar scores because financial and impact data is missing. Complete research before using this as a final ranking."
        : "Score spread looks reasonably differentiated.",
    })
  })

  return router
}
