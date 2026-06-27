import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import { useClientActivityQuery } from "../hooks/use-client-activity-query"
import { useSharedDataStatusQuery } from "../hooks/use-shared-data-status-query"
import type { ClientActivityEntry } from "../types/shared-data"

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatActionLabel(actionType: ClientActivityEntry["actionType"]): string {
  return actionType.replaceAll("_", " ")
}

function formatAmountSummary(entry: ClientActivityEntry): string {
  const value = entry.newValue ?? entry.oldValue
  if (!value) return "—"

  const amount = value.amount ?? value.donationAmount
  const date = value.date
  const parts: string[] = []

  if (typeof amount === "number") parts.push(`$${amount.toLocaleString()}`)
  if (typeof date === "string" && date) parts.push(date)

  return parts.length > 0 ? parts.join(" · ") : "—"
}

function formatDetails(entry: ClientActivityEntry): string {
  if (entry.actionType === "advisor_export_generated" && entry.newValue) {
    const selectedCount = entry.newValue.selectedCount
    const totalDonationAmount = entry.newValue.totalDonationAmount
    if (typeof selectedCount === "number" && typeof totalDonationAmount === "number") {
      return `${selectedCount} rows · $${totalDonationAmount.toLocaleString()} total`
    }
  }

  const note = entry.newValue?.note ?? entry.oldValue?.note
  if (typeof note === "string" && note.trim()) return note.trim()

  const notes = entry.newValue?.notes ?? entry.oldValue?.notes
  if (typeof notes === "string" && notes.trim()) return notes.trim()

  return "—"
}

export function ClientActivityPage() {
  const statusQuery = useSharedDataStatusQuery()
  const activityQuery = useClientActivityQuery(100)

  if (statusQuery.isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!statusQuery.data?.sharedDataEnabled) {
    return (
      <Alert severity="warning">
        Client Activity requires Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server,
        run the SQL schema in supabase/schema.sql, then redeploy.
      </Alert>
    )
  }

  if (activityQuery.isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (activityQuery.isError) {
    return <Alert severity="error">Could not load client activity.</Alert>
  }

  const entries = activityQuery.data ?? []

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Paper sx={{ p: { md: 4, xs: 3 } }}>
        <Typography gutterBottom variant="h3">
          Client Activity
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 820, mt: 1.5 }}>
          Recent donation and advisor export changes saved to Supabase. Newest changes appear first.
        </Typography>
      </Paper>

      {entries.length === 0 ? (
        <Alert severity="info">No client activity logged yet.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Organization</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Amount / date</TableCell>
                <TableCell>Changed by</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatTimestamp(entry.createdAt)}</TableCell>
                  <TableCell>{entry.organizationName ?? "—"}</TableCell>
                  <TableCell>
                    <Chip label={formatActionLabel(entry.actionType)} size="small" />
                  </TableCell>
                  <TableCell>{formatAmountSummary(entry)}</TableCell>
                  <TableCell>{entry.actorName}</TableCell>
                  <TableCell>{formatDetails(entry)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
