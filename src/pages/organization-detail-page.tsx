import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Typography,
} from "@mui/material"
import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { ScoreExplanationCard } from "../components/score-explanation-card/score-explanation-card"
import { DonationLedger } from "../components/donation-ledger/donation-ledger"
import { OrganizationAddressForm } from "../components/organization-address-form/organization-address-form"
import { OrganizationMissionOverlapForm } from "../components/organization-mission-overlap-form/organization-mission-overlap-form"
import { OrganizationResearchNotesForm } from "../components/organization-research-notes-form/organization-research-notes-form"
import { useOrganizationQuery } from "../hooks/use-organization-query"
import { useResearchOrganizationMutation } from "../hooks/use-organization-research-mutations"
import type { Recommendation } from "../types/organization"
import {
  formatAdvocacyReviewLabel,
  formatFinancialCompletenessLabel,
  formatImpactEvidenceLevelShort,
  formatLegalVerificationLabel,
  formatResearchStatusLabel,
  formatStewardshipScoreDisplay,
  getAdvocacyReviewChipColor,
  isStewardshipRenormalized,
  shouldShowAdvocacyReviewChip,
} from "../utils/ranking-display-labels"

function getRecommendationColor(recommendation: Recommendation): "default" | "success" | "warning" | "error" {
  if (recommendation === "Priority Fund" || recommendation === "Keep") return "success"
  if (recommendation === "Pause / Do Not Fund") return "error"
  if (recommendation === "Reduce" || recommendation === "Review Before Donating") return "warning"
  return "default"
}

export function OrganizationDetailPage() {
  const { id = "" } = useParams()
  const { data, isLoading, isError } = useOrganizationQuery(id)
  const researchOrganizationMutation = useResearchOrganizationMutation(id)

  const organization = data?.organization
  const donationSummaries = data?.donationSummaries ?? []
  const explanation = organization?.scoreBreakdown?.rankingExplanation
  const sourceMetaEntries = useMemo(() => Object.entries(organization?.sourceMeta ?? {}), [organization])
  const researchErrors = useMemo(() => organization?.researchErrors ?? [], [organization])

  if (isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography>Loading organization details...</Typography>
      </Box>
    )
  }

  if (isError || !organization) {
    return <Alert severity="error">Could not load this organization.</Alert>
  }

  const stewardshipScore =
    organization.objectiveStewardshipScore ?? organization.stewardshipScore
  const renormalized = isStewardshipRenormalized(organization.financialCompletenessStatus)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ alignItems: "flex-start", display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h4">{organization.organizationName}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {organization.rankingListLabel}
              {organization.subcategory ? ` • ${organization.subcategory}` : ""}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => researchOrganizationMutation.mutate()}
              disabled={researchOrganizationMutation.isPending}
            >
              {researchOrganizationMutation.isPending ? "Researching..." : "Run public-source research"}
            </Button>
            <Button component={Link} to={`/print/organizations/${organization.id}`} variant="outlined">
              Printable summary
            </Button>
          </Box>
        </Box>
        {researchOrganizationMutation.isSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Public-source research completed for this organization.
          </Alert>
        )}
        {researchOrganizationMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Could not run public-source research for this organization.
          </Alert>
        )}
        {organization.website && (
          <Typography sx={{ mt: 1 }}>
            Website:{" "}
            <a href={organization.website} target="_blank" rel="noreferrer">
              {organization.website}
            </a>
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Mailing address
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Save the main address you use when mailing checks or gifts to this organization.
        </Typography>
        <OrganizationAddressForm organizationId={organization.id} address={organization.address} />
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Your donation history
        </Typography>
        <DonationLedger organizationId={organization.id} donationSummaries={donationSummaries} />
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Mission overlap tags
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Group organizations that do similar work so Portfolio Review can surface consolidation opportunities.
        </Typography>
        <OrganizationMissionOverlapForm
          organizationId={organization.id}
          duplicateMission={organization.duplicateMission}
          duplicateMissionGroup={organization.duplicateMissionGroup}
          duplicateMissionRole={organization.duplicateMissionRole}
        />
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Research notes
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Edit impact, accountability, and advocacy notes. Saving recalculates impact evidence level, review flags,
          recommendations, and stewardship components that depend on accountability or political notes.
        </Typography>
        <OrganizationResearchNotesForm
          organizationId={organization.id}
          impactEvidenceNotes={organization.impactEvidenceNotes}
          accountabilityNotes={organization.accountabilityNotes}
          politicalInvolvementNotes={organization.politicalInvolvementNotes}
        />
      </Paper>

      {explanation ? (
        <>
          <Alert severity="info" sx={{ "& .MuiAlert-message": { width: "100%" } }}>
            <Typography variant="h6" gutterBottom>
              {explanation.headline}
            </Typography>
            <Typography>{explanation.overallSummary}</Typography>
          </Alert>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              What this means for your giving
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
              <Chip label={`Recommendation: ${organization.recommendation}`} color={getRecommendationColor(organization.recommendation)} />
              <Chip
                label={formatStewardshipScoreDisplay(stewardshipScore, organization.scoreBand, renormalized)}
                variant="outlined"
              />
              <Chip label={formatResearchStatusLabel(organization.rankingStatus)} variant="outlined" />
              <Chip label={formatLegalVerificationLabel(organization.legalVerificationStatus)} variant="outlined" />
              <Chip label={formatImpactEvidenceLevelShort(organization.impactEvidenceLevel)} variant="outlined" />
              <Chip
                label={formatFinancialCompletenessLabel(organization.financialCompletenessStatus)}
                variant="outlined"
                color={organization.financialCompletenessStatus === "complete" ? "default" : "warning"}
              />
              <Chip label={`Confidence: ${organization.confidenceBand} (${organization.confidenceScore}%)`} />
              {organization.watchdogReviewRequired && (
                <Chip label="Watchdog review" color="warning" variant="outlined" />
              )}
              {shouldShowAdvocacyReviewChip(organization.advocacyReviewStatus) && (
                <Chip
                  label={formatAdvocacyReviewLabel(organization.advocacyReviewStatus)}
                  color={getAdvocacyReviewChipColor(organization.advocacyReviewStatus)}
                  variant="outlined"
                />
              )}
              {organization.legacyEligible ? <Chip label={`Legacy: ${organization.legacyTier}`} color="success" /> : null}
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
              <Chip label={`List rank: #${organization.listObjectiveRank} objective / #${organization.listPersonalizedRank} personalized`} variant="outlined" />
              <Chip label={`Global rank: #${organization.globalObjectiveRank} objective / #${organization.globalPersonalizedRank} personalized`} variant="outlined" />
              <Chip label={`${new Date().getFullYear()} gift: $${organization.approximateAnnualDonation.toFixed(0)}`} variant="outlined" />
              <Chip label={`Org size: ${organization.organizationSize}`} variant="outlined" />
            </Box>
            {renormalized && (
              <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                * Financial component excluded from stewardship score — remaining categories were renormalized.
              </Typography>
            )}
            {organization.legacyExclusionReason && !organization.legacyEligible ? (
              <Typography color="text.secondary" sx={{ mb: 1 }}>
                Legacy exclusion: {organization.legacyExclusionReason}
              </Typography>
            ) : null}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Gift size review (separate from stewardship score)
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
              {organization.donationAmountAssessment}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {explanation.recommendationTitle}
            </Typography>
            <Typography sx={{ mt: 0.75 }}>{explanation.recommendationExplanation}</Typography>
            <Typography sx={{ mt: 1.5 }}>{explanation.donorHistoryExplanation}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography sx={{ fontWeight: 600 }}>{explanation.bottomLine}</Typography>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              How your ranks work
            </Typography>
            <Typography sx={{ mb: 1 }}>
              <strong>List rank in {organization.rankingListLabel} (#{organization.listObjectiveRank} objective / #{organization.listPersonalizedRank} personalized):</strong>{" "}
              {explanation.rankExplanation}
            </Typography>
            <Typography>
              <strong>Personalized list rank:</strong> {explanation.personalizedRankExplanation}
            </Typography>
            {organization.donorConfidenceAdjustment > 0 && (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Donor boost applied: +{organization.donorConfidenceAdjustment} points
              </Typography>
            )}
          </Paper>

          {(explanation.strengths.length > 0 || explanation.concerns.length > 0) && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Quick summary
              </Typography>
              {explanation.strengths.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 600, mb: 0.75 }}>Strengths</Typography>
                  {explanation.strengths.map((item) => (
                    <Typography key={item}>• {item}</Typography>
                  ))}
                </Box>
              )}
              {explanation.concerns.length > 0 && (
                <Box>
                  <Typography sx={{ fontWeight: 600, mb: 0.75 }}>Things to review</Typography>
                  {explanation.concerns.map((item) => (
                    <Typography key={item}>• {item}</Typography>
                  ))}
                </Box>
              )}
            </Paper>
          )}

          {explanation.missingDataNote && (
            <Alert severity="warning">{explanation.missingDataNote}</Alert>
          )}

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Stewardship breakdown
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              How the stewardship score was built. Impact evidence level and review flags are shown separately and do
              not change list rank.
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {explanation.categories.map((category) => (
                <ScoreExplanationCard key={category.key} category={category} />
              ))}
            </Box>
          </Paper>
        </>
      ) : (
        <Alert severity="warning">Detailed ranking explanations are not available for this organization yet.</Alert>
      )}

      <Accordion>
        <AccordionSummary>
          <Typography sx={{ fontWeight: 600 }}>Additional notes and research details</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Watchdog ratings
              </Typography>
              <Typography>
                Charity Navigator:{" "}
                {organization.charityNavigatorRating !== null ? `${organization.charityNavigatorRating} stars` : "Not on file"}
              </Typography>
              {organization.charityNavigatorProfileUrl && (
                <Typography sx={{ mt: 0.5 }}>
                  CN profile:{" "}
                  <a href={organization.charityNavigatorProfileUrl} target="_blank" rel="noreferrer">
                    {organization.charityNavigatorProfileUrl}
                  </a>
                </Typography>
              )}
              {organization.charityNavigatorAlert && (
                <Typography sx={{ mt: 0.5 }}>CN alert: {organization.charityNavigatorAlert}</Typography>
              )}
              <Typography sx={{ mt: 0.5 }}>
                CharityWatch: {organization.charityWatchGrade ?? "Not on file"}
              </Typography>
              <Typography sx={{ mt: 0.5 }}>
                ACE: {organization.aceRecommendation ?? "Not matched to ACE recommended list"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Impact notes
              </Typography>
              <Typography>{organization.impactEvidenceNotes || "No additional impact notes yet."}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Accountability notes
              </Typography>
              <Typography>{organization.accountabilityNotes || "No additional accountability notes yet."}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Political or advocacy notes
              </Typography>
              <Typography>{organization.politicalInvolvementNotes || "No political notes recorded."}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Legacy giving
              </Typography>
              <Typography>
                Legacy eligible: {organization.legacyEligible ? "Yes" : "Not yet"} • {organization.legacyTier}
              </Typography>
              <Typography sx={{ mt: 0.5 }}>{organization.legacyRationale}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Research status
              </Typography>
              <Typography>
                Research status: {formatResearchStatusLabel(organization.rankingStatus)} • Confidence: {organization.confidenceScore}% • Pipeline: {organization.researchStatus}
              </Typography>
              <Typography sx={{ mt: 0.5 }}>Next step: {organization.strongestNextResearchStep}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Red flags
              </Typography>
              {!organization.redFlags.length && <Typography>No red flags recorded.</Typography>}
              {organization.redFlags.map((flag) => (
                <Typography key={flag}>• {flag}</Typography>
              ))}
            </Box>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Research source notes
              </Typography>
              {sourceMetaEntries.length === 0 && <Typography>No source notes recorded yet.</Typography>}
              {sourceMetaEntries.map(([field, source]) => (
                <Box key={field} sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    <strong>{field}:</strong> {source.confidenceNote}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {source.sourceName} • {new Date(source.fetchedAt).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
            {researchErrors.length > 0 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Research errors
                </Typography>
                {researchErrors.map((error, index) => (
                  <Typography key={`${error.sourceName}-${index}`} variant="body2">
                    • {error.sourceName}: {error.message}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
