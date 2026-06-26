import { Alert, Box, CircularProgress, Paper, Typography } from "@mui/material"
import { useGivingPlanQuery } from "../hooks/use-giving-plan-query"
import { formatResearchStatusLabel } from "../utils/ranking-display-labels"

export function GivingPlanPage() {
  const { data, isLoading, isError } = useGivingPlanQuery()

  if (isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography>Loading compact giving plan...</Typography>
      </Box>
    )
  }

  if (isError || !data) {
    return <Alert severity="error">Could not load compact giving plan.</Alert>
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Compact Giving Plan
        </Typography>
        <Typography color="text.secondary">
          Keep your giving focused by supporting fewer, stronger organizations in each mission area.
        </Typography>
      </Paper>

      {data.map((group) => (
        <Paper key={group.missionBucket} sx={{ p: 3 }}>
          <Typography variant="h6">{group.missionBucket}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Current organizations: {group.organizationCount} • Suggested to keep: {group.suggestedKeepCount}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.25 }}>
            Current annual donations in this bucket: ${group.totalCurrentAnnualDonations.toFixed(0)}
          </Typography>
          <Typography sx={{ mt: 1.25 }}>{group.consolidationReason}</Typography>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Top research-complete organizations</Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
              {group.topRecommended.length === 0 && <Typography color="text.secondary">No top recommendations yet.</Typography>}
              {group.topRecommended.map((organization) => (
                <Typography key={organization.id}>
                  • {organization.organizationName} ({organization.recommendation}, stewardship {organization.verifiedStewardshipScore})
                </Typography>
              ))}
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Promising but research-incomplete organizations</Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
              {group.promisingUnverified.length === 0 && (
                <Typography color="text.secondary">No promising research-incomplete organizations right now.</Typography>
              )}
              {group.promisingUnverified.map((organization) => (
                <Typography key={organization.id}>
                  • {organization.organizationName} ({formatResearchStatusLabel(organization.rankingStatus)}, preliminary stewardship {organization.preliminaryStewardshipScore})
                </Typography>
              ))}
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Organizations to reduce or pause</Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
              {group.reduceOrPause.length === 0 && <Typography color="text.secondary">None right now.</Typography>}
              {group.reduceOrPause.map((organization) => (
                <Typography key={organization.id}>
                  • {organization.organizationName} ({organization.recommendation})
                </Typography>
              ))}
            </Box>
          </Box>
        </Paper>
      ))}
    </Box>
  )
}
