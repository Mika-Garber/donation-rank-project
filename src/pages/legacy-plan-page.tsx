import { Alert, Box, CircularProgress, Paper, Typography } from "@mui/material"
import { useLegacyPlanQuery } from "../hooks/use-legacy-plan-query"

export function LegacyPlanPage() {
  const { data, isLoading, isError } = useLegacyPlanQuery()

  if (isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography>Loading legacy plan...</Typography>
      </Box>
    )
  }

  if (isError || !data) {
    return <Alert severity="error">Could not load legacy plan.</Alert>
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Legacy Plan
        </Typography>
        <Typography color="text.secondary">
          This plan helps your family keep giving focused by category and avoid random one-off decisions.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Rules for family fund management
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {data.legacyRules.map((rule) => (
            <Typography key={rule}>• {rule}</Typography>
          ))}
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Default mission allocation (editable in config)
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {Object.entries(data.allocationDefaults).map(([area, percent]) => (
            <Typography key={area}>
              • {area}: {percent}%
            </Typography>
          ))}
        </Box>
      </Paper>

      {data.organizationsByArea.map((group) => (
        <Paper key={group.missionArea} sx={{ p: 3 }}>
          <Typography variant="h6">{group.missionArea}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Suggested allocation: {group.defaultAllocationPercent}%
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 1 }}>
            {group.organizations.length === 0 && (
              <Typography color="text.secondary">No legacy-eligible organizations in this area yet.</Typography>
            )}
            {group.organizations.map((organization) => (
              <Typography key={organization.id}>
                • {organization.organizationName} ({organization.legacyTier}, stewardship {organization.verifiedStewardshipScore}, confidence{" "}
                {organization.confidenceScore}%)
              </Typography>
            ))}
          </Box>
        </Paper>
      ))}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Excluded from legacy right now
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {data.excludedOrganizations.length === 0 && <Typography>None excluded right now.</Typography>}
          {data.excludedOrganizations.map((organization) => (
            <Typography key={organization.id}>
              • {organization.organizationName}: {organization.reason || "Not legacy eligible yet — needs more research."}
            </Typography>
          ))}
        </Box>
      </Paper>
    </Box>
  )
}
