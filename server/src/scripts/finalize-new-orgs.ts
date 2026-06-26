import { readStoredOrganizations, saveOrganizations } from "../services/data-store-service.js"
import { syncDonationDerivedFields } from "../services/donation-service.js"
import { rankOrganizations } from "../services/ranking-service.js"
import type { Organization, MissionBucket } from "../types/organization.js"

const now = new Date().toISOString()

interface OrgPatch {
  ein: string
  programPercent: number
  fundraisingPercent: number
  adminPercent: number
  missionBucket?: MissionBucket
  politicalInvolvementNotes: string
  accountabilityNotes: string
  impactAppend?: string
  notesAppend: string
}

const PATCHES: OrgPatch[] = [
  {
    ein: "04-3817491",
    programPercent: 65.6,
    fundraisingPercent: 10.6,
    adminPercent: 23.8,
    politicalInvolvementNotes:
      "The Humane League runs corporate cage-free campaigns, grassroots pressure campaigns, and policy advocacy (including Animal Policy Alliance work on farm-animal protection laws such as California Proposition 12). Activity is issue-based and mission-aligned rather than partisan electoral work; donors who prefer direct animal care only should weigh advocacy exposure.",
    accountabilityNotes:
      "EIN 04-3817491 confirmed via ProPublica/Form 990. Charity Navigator 4-star rating. ACE Recommended Charity (12 consecutive years per 2025 annual report). Form 990 TY2024 functional expense ratios applied from uploaded full filing PDF.",
    impactAppend:
      "Additional research: 2025 annual report (https://act.thehumaneleague.org/annual-report-2025) — quantified outcomes:\n- 7.5 million hens spared from cages globally in 2025\n- 160M+ animals set to benefit from successful negotiations and pressure campaigns\n- 46.4% of U.S. egg-laying hens now living outside cages\n- 92% of corporate cage-free commitments with 2024-or-earlier deadlines fulfilled\n- 234 new corporate cage-free commitments secured via Open Wing Alliance (82 member orgs across 72 countries)\n- 1.48M+ messages sent to decision-makers; 56k donations from 15.4K supporters\n- Named ACE Recommended Charity for the 12th consecutive year",
    notesAppend:
      "Manual Form 990 extraction (TY2024): Program 65.6%, Fundraising 10.6%, Admin 23.8% from full filing PDF (The Humane League - Full Filing - Nonprofit Explorer - ProPublica.pdf).",
  },
  {
    ein: "04-6043108",
    programPercent: 63.5,
    fundraisingPercent: 19.8,
    adminPercent: 16.7,
    missionBucket: "Veterinary / Medical Animal Care" as const,
    politicalInvolvementNotes:
      "American Fondouk operates a charitable veterinary hospital in Fez, Morocco providing free treatment for working equines and other animals. MSPCA-Angell oversees the endowment and operations. No significant partisan political activity identified; mission is direct veterinary care for subsistence-farming communities.",
    accountabilityNotes:
      "EIN 04-6043108 confirmed via ProPublica/Form 990. 501(c)(3) since 1937. Charity Navigator 4-star rating. MSPCA provides oversight of endowment and operations per official history. Form 990 TY2024 functional expense ratios applied from uploaded full filing PDF.",
    impactAppend:
      "Additional research: official history (https://www.fondouk.org/our-history) — full-service animal hospital in Fez treating thousands of working animals annually; staffed with resident veterinarians, blacksmith, onsite laboratory and surgical facility; MSPCA oversight since founding in 1927.",
    notesAppend:
      "Manual Form 990 extraction (TY2024): Program 63.5%, Fundraising 19.8%, Admin 16.7% from full filing PDF (American-Fondouk-Maintenance-Committee-Inc.-2024-Form-990-Open-to-Publi....pdf).",
  },
  {
    ein: "58-2040413",
    programPercent: 82.8,
    fundraisingPercent: 7.5,
    adminPercent: 9.6,
    politicalInvolvementNotes:
      "CAPS investigates puppy mills, pet stores, and USDA-licensed research animal dealers and uses investigative findings to drive policy and consumer awareness. Advocacy is issue-based and aligned with ending companion-animal exploitation; donors preferring hands-on rescue only should consider overlap with other advocacy groups.",
    accountabilityNotes:
      "EIN 58-2040413 confirmed via ProPublica/Form 990. Charity Navigator 4-star rating. Form 990 TY2024 functional expense ratios applied from uploaded full filing PDF and CAPS-Final-FS-2024.pdf.",
    notesAppend:
      "Manual Form 990 extraction (TY2024): Program 82.8%, Fundraising 7.5%, Admin 9.6% from full filing PDF (Companion Animal Protection Society - Full Filing - Nonprofit Explorer - ProPublica.pdf).",
  },
  {
    ein: "23-0341990",
    programPercent: 72.9,
    fundraisingPercent: 13.2,
    adminPercent: 13.8,
    politicalInvolvementNotes:
      "AAVS promotes alternatives to animal use in research, testing, and education through public education, grants, and policy engagement on anti-vivisection issues. Activity appears issue-based and mission-aligned; separate from National Anti-Vivisection Society (NAVS). Donors with direct-care-only preferences should note advocacy focus.",
    accountabilityNotes:
      "EIN 23-0341990 confirmed via ProPublica/Form 990. Charity Navigator 4-star rating. Form 990 TY2024 functional expense ratios applied from uploaded full filing PDF.",
    notesAppend:
      "Manual Form 990 extraction (TY2024): Program 72.9%, Fundraising 13.2%, Admin 13.8% from full filing PDF (American Anti Vivisection Society - Full Filing - Nonprofit Explorer - ProPublica.pdf).",
  },
]

function applyFinancialSourceMeta(organization: Organization, patch: OrgPatch): void {
  const sourceMeta = organization.sourceMeta ?? {}
  for (const field of ["programPercent", "fundraisingPercent", "adminPercent"] as const) {
    sourceMeta[field] = {
      sourceName: "Form 990 PDF extraction",
      fetchedAt: now,
      confidenceNote: "Ratios extracted directly from uploaded full filing PDF (TY2024).",
      sourceType: "ProPublica/Form 990",
      reliability: "high",
    }
  }
  sourceMeta.is501c3Verified = {
    sourceName: "ProPublica Nonprofit Explorer",
    fetchedAt: now,
    confidenceNote: "Subsection code indicates 501(c)(3).",
    sourceType: "ProPublica/Form 990",
    reliability: "high",
  }
  organization.sourceMeta = sourceMeta
}

function applyPatch(organization: Organization, patch: OrgPatch): void {
  organization.is501c3Verified = "Y"
  organization.programPercent = patch.programPercent
  organization.fundraisingPercent = patch.fundraisingPercent
  organization.adminPercent = patch.adminPercent
  organization.politicalInvolvementNotes = patch.politicalInvolvementNotes
  organization.accountabilityNotes = patch.accountabilityNotes
  organization.lastRefreshedAt = now

  if (patch.missionBucket) {
    organization.missionBucket = patch.missionBucket
  }

  const existingNotes = String(organization.notes ?? "").trim()
  if (!existingNotes.includes(patch.notesAppend)) {
    organization.notes = existingNotes ? `${existingNotes} | ${patch.notesAppend}` : patch.notesAppend
  }

  if (patch.impactAppend) {
    const existingImpact = String(organization.impactEvidenceNotes ?? "").trim()
    if (!existingImpact.includes(patch.impactAppend.slice(0, 40))) {
      organization.impactEvidenceNotes = existingImpact
        ? `${existingImpact}\n\n${patch.impactAppend}`
        : patch.impactAppend
    }
  }

  applyFinancialSourceMeta(organization, patch)
}

async function main(): Promise<void> {
  const organizations = await readStoredOrganizations()

  for (const patch of PATCHES) {
    const normalizedEin = patch.ein.replace(/\D/g, "")
    const organization = organizations.find((org) => String(org.ein ?? "").replace(/\D/g, "") === normalizedEin)
    if (!organization) {
      console.log(`Missing org for EIN ${patch.ein}`)
      continue
    }
    applyPatch(organization, patch)
    console.log(`Patched: ${organization.organizationName}`)
  }

  const ranked = rankOrganizations(organizations.map(syncDonationDerivedFields))
  await saveOrganizations(ranked)

  console.log("\n--- Final rankings ---")
  for (const patch of PATCHES) {
    const normalizedEin = patch.ein.replace(/\D/g, "")
    const org = ranked.find((item) => String(item.ein ?? "").replace(/\D/g, "") === normalizedEin)
    if (!org) continue
    console.log(
      JSON.stringify({
        name: org.organizationName,
        stewardship: org.stewardshipScore,
        recommendation: org.recommendation,
        rankingStatus: org.rankingStatus,
        impact: org.impactEvidenceLevel,
        program: org.programPercent,
        listRank: org.listObjectiveRank,
        globalRank: org.globalObjectiveRank,
        research: org.researchStatus,
        legal: org.legalVerificationStatus,
      }),
    )
  }
  console.log(`\nTotal organizations: ${ranked.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
