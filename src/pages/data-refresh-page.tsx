import { Alert, Box, Button, Chip, CircularProgress, Paper, Typography } from "@mui/material"
import { useQuery } from "@tanstack/react-query"
import { useRefreshDataMutation, useRefreshStatusQuery } from "../hooks/use-refresh-data-mutation"
import { useResearchAddressesMutation } from "../hooks/use-research-addresses-mutation"
import { useResearchImpactFrom990sMutation, useRunFreeResearchMutation } from "../hooks/use-organization-research-mutations"
import { useTriageQuery } from "../hooks/use-triage-query"
import { getWatchdogSetup } from "../services/api-client"

export function DataRefreshPage() {
  const refreshStatusQuery = useRefreshStatusQuery()
  const refreshDataMutation = useRefreshDataMutation()
  const researchAddressesMutation = useResearchAddressesMutation()
  const researchImpactMutation = useResearchImpactFrom990sMutation()
  const runFreeResearchMutation = useRunFreeResearchMutation()
  const triageQuery = useTriageQuery(10)
  const watchdogSetupQuery = useQuery({
    queryKey: ["watchdog-setup"],
    queryFn: getWatchdogSetup,
  })

  async function handleRefresh(): Promise<void> {
    await refreshDataMutation.mutateAsync()
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Research all organizations now
        </Typography>
        <Typography color="text.secondary">
          Run full public-source research for every organization to improve confidence and reduce missing fields.
        </Typography>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Run all free research (recommended)
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Refreshes ProPublica, Charity Navigator, CharityWatch catalog, and ACE catalog, pulls missing financial
          ratios and impact notes from IRS e-file XML, and scrapes each org website for impact / annual-report pages.
          Re-ranks automatically when done. Newly added charities are included.
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Free research can verify IRS/990/watchdog/website data when available. Annual reports or impact PDFs may still need to be added manually if the app cannot find them online.
        </Alert>
        <Button
          variant="contained"
          size="large"
          onClick={() => runFreeResearchMutation.mutate()}
          disabled={runFreeResearchMutation.isPending}
        >
          {runFreeResearchMutation.isPending ? "Running free research..." : "Run all free research"}
        </Button>
        {runFreeResearchMutation.isSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {runFreeResearchMutation.data.message}
          </Alert>
        )}
        {runFreeResearchMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Free research failed. Verify the API server is running and python3 is available.
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Button variant="outlined" size="large" onClick={handleRefresh} disabled={refreshDataMutation.isPending}>
            {refreshDataMutation.isPending ? "Researching..." : "Research all organizations only"}
          </Button>

          {refreshDataMutation.isPending && (
            <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
              <CircularProgress size={18} />
              <Typography>Researching organizations...</Typography>
            </Box>
          )}

          {refreshDataMutation.isSuccess && (
            <Alert severity="success">
              Research complete. Processed {refreshDataMutation.data.processedCount} organizations, updated{" "}
              {refreshDataMutation.data.updatedCount}, changed {refreshDataMutation.data.changedFieldsCount} fields,
              and flagged {(refreshDataMutation.data.failedOrganizations ?? []).length} with errors.
            </Alert>
          )}

          {refreshDataMutation.isError && (
            <Alert severity="error">Refresh failed. Please try again and verify the API server logs.</Alert>
          )}
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Refresh mailing addresses from IRS records
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Pulls the official street address on file with the IRS via ProPublica for every organization with an EIN.
          This replaces city-only guesses and is more reliable than CharityWatch for addresses.
        </Typography>
        <Button
          variant="outlined"
          onClick={() => researchAddressesMutation.mutate()}
          disabled={researchAddressesMutation.isPending}
        >
          {researchAddressesMutation.isPending ? "Updating addresses..." : "Update all mailing addresses"}
        </Button>
        {researchAddressesMutation.isSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Address refresh complete. Updated {researchAddressesMutation.data.updatedCount} organizations, skipped{" "}
            {researchAddressesMutation.data.skippedCount}, failed {researchAddressesMutation.data.failedCount}.
          </Alert>
        )}
        {researchAddressesMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Address refresh failed. Please verify the API server is running.
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Extract impact evidence from Form 990 PDFs
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Reads Part III program accomplishments from the PDFs in info/form-990s/, adds quantified outcomes to impact
          notes, and recalculates rankings. Manual notes are kept and appended when possible.
        </Typography>
        <Button
          variant="outlined"
          onClick={() => researchImpactMutation.mutate({ mergeManualNotes: true, force: false })}
          disabled={researchImpactMutation.isPending}
        >
          {researchImpactMutation.isPending ? "Extracting impact evidence..." : "Extract impact from all 990 PDFs"}
        </Button>
        {researchImpactMutation.isSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {researchImpactMutation.data.message} Applied {researchImpactMutation.data.applied}, merged{" "}
            {researchImpactMutation.data.merged}, skipped {researchImpactMutation.data.skipped}.
          </Alert>
        )}
        {researchImpactMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Impact extraction failed. Verify python3 and pdfplumber are installed, then check server logs.
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Watchdog sources setup
        </Typography>
        {watchdogSetupQuery.isLoading && <Typography>Loading watchdog setup status...</Typography>}
        {watchdogSetupQuery.isError && <Alert severity="warning">Could not load watchdog setup status.</Alert>}
        {watchdogSetupQuery.data && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontWeight: 600 }}>Charity Navigator</Typography>
                <Chip
                  size="small"
                  color={watchdogSetupQuery.data.charityNavigator.configured ? "success" : "warning"}
                  label={watchdogSetupQuery.data.charityNavigator.configured ? "API key configured" : "API key missing"}
                />
              </Box>
              <Typography color="text.secondary">{watchdogSetupQuery.data.charityNavigator.instructions}</Typography>
            </Box>
            <Box>
              <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontWeight: 600 }}>CharityWatch</Typography>
                <Chip
                  size="small"
                  color={watchdogSetupQuery.data.charityWatch.configured ? "success" : "default"}
                  label={`${watchdogSetupQuery.data.charityWatch.entryCount} catalog entries`}
                />
              </Box>
              <Typography color="text.secondary">{watchdogSetupQuery.data.charityWatch.instructions}</Typography>
            </Box>
            <Box>
              <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontWeight: 600 }}>Animal Charity Evaluators (ACE)</Typography>
                <Chip
                  size="small"
                  color={watchdogSetupQuery.data.ace.configured ? "success" : "default"}
                  label={`${watchdogSetupQuery.data.ace.recommendedCount} recommended / ${watchdogSetupQuery.data.ace.standoutCount} standout`}
                />
              </Box>
              <Typography color="text.secondary">{watchdogSetupQuery.data.ace.instructions}</Typography>
            </Box>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6">Last refresh</Typography>
        {refreshStatusQuery.isLoading && <Typography>Loading latest refresh status...</Typography>}
        {refreshStatusQuery.isError && <Alert severity="warning">Could not load latest refresh status.</Alert>}
        {!refreshStatusQuery.isLoading && !refreshStatusQuery.data && (
          <Typography color="text.secondary">No refresh has run yet.</Typography>
        )}
        {refreshStatusQuery.data && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 1 }}>
            <Typography>Processed organizations: {refreshStatusQuery.data.processedCount ?? "N/A"}</Typography>
            <Typography>Updated organizations: {refreshStatusQuery.data.updatedCount}</Typography>
            <Typography>Changed fields: {refreshStatusQuery.data.changedFieldsCount}</Typography>
            <Typography>
              Failed organizations: {(refreshStatusQuery.data.failedOrganizations ?? []).length}
            </Typography>
            <Typography>Fetched at: {new Date(refreshStatusQuery.data.fetchedAt).toLocaleString()}</Typography>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Weekly operating flow
        </Typography>
        <Typography>1) Click "Research all organizations"</Typography>
        <Typography>2) Review only the triage queue below</Typography>
        <Typography>3) Resolve top 5 next actions</Typography>
        <Typography sx={{ mt: 1.5 }}>
          Monthly: manually verify top stewardship organizations and any larger gifts with low confidence.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Current triage queue
        </Typography>
        {triageQuery.isLoading && <Typography>Loading triage queue...</Typography>}
        {triageQuery.isError && <Alert severity="warning">Could not load triage queue.</Alert>}
        {!triageQuery.isLoading && !triageQuery.data?.length && (
          <Typography color="text.secondary">No high-priority triage items.</Typography>
        )}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {(triageQuery.data ?? []).map((item) => (
            <Box
              key={item.id}
              sx={{ border: "1px solid #e3e7ef", borderRadius: 1.5, display: "flex", flexDirection: "column", gap: 0.5, p: 1.5 }}
            >
              <Typography>{item.organizationName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {item.recommendation} • Stewardship {item.stewardshipScore} • Confidence {item.confidenceScore}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Next action: {item.nextAction}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Priority reasons: {item.priorityReasons.join("; ") || "General review"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Research tasks: {item.researchChecklist.join("; ") || "Review manually"}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  )
}
