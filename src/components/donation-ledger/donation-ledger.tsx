import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material"
import { useMemo, useState } from "react"
import {
  useAddDonationMutation,
  useDeleteDonationMutation,
  useUpdateDonationMutation,
} from "../../hooks/use-donation-mutations"
import type { DonationRecord, DonationYearSummary } from "../../types/organization"

interface DonationLedgerProps {
  organizationId: string
  donationSummaries: DonationYearSummary[]
}

interface DonationFormState {
  date: string
  amount: string
  note: string
}

const EMPTY_FORM: DonationFormState = {
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  note: "",
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function DonationLedger({ organizationId, donationSummaries }: DonationLedgerProps) {
  const [form, setForm] = useState<DonationFormState>(EMPTY_FORM)
  const [editingDonation, setEditingDonation] = useState<DonationRecord | null>(null)
  const addDonation = useAddDonationMutation(organizationId)
  const updateDonation = useUpdateDonationMutation(organizationId)
  const deleteDonation = useDeleteDonationMutation(organizationId)

  const currentYear = String(new Date().getFullYear())
  const currentYearSummary = useMemo(
    () => donationSummaries.find((summary) => summary.year === currentYear),
    [currentYear, donationSummaries],
  )

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingDonation(null)
  }

  function handleSubmit() {
    const amount = Number.parseFloat(form.amount)
    if (!form.date || Number.isNaN(amount) || amount <= 0) return

    if (editingDonation) {
      updateDonation.mutate(
        {
          donationId: editingDonation.id,
          date: form.date,
          amount,
          note: form.note,
        },
        { onSuccess: resetForm },
      )
      return
    }

    addDonation.mutate(
      {
        date: form.date,
        amount,
        note: form.note,
      },
      { onSuccess: resetForm },
    )
  }

  function handleEdit(donation: DonationRecord) {
    setEditingDonation(donation)
    setForm({
      date: donation.date,
      amount: String(donation.amount),
      note: donation.note,
    })
  }

  function handleDelete(donationId: string) {
    deleteDonation.mutate(donationId, {
      onSuccess: () => {
        if (editingDonation?.id === donationId) resetForm()
      },
    })
  }

  const isSaving = addDonation.isPending || updateDonation.isPending

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Alert severity="info">
        Log each gift when you donate. Totals are grouped by calendar year. This year&apos;s total drives your
        personalized ranking boost.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          {currentYear} giving so far
        </Typography>
        <Typography variant="h5">{formatCurrency(currentYearSummary?.total ?? 0)}</Typography>
        <Typography color="text.secondary">
          {currentYearSummary?.count ?? 0} gift{(currentYearSummary?.count ?? 0) === 1 ? "" : "s"} logged this year
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          {editingDonation ? "Edit donation" : "Log a donation"}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="Date"
            type="date"
            value={form.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            label="Amount"
            type="number"
            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            fullWidth
          />
        </Stack>
        <TextField
          label="Note (optional)"
          placeholder="Check #123, monthly gift, memorial gift..."
          value={form.note}
          onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
          fullWidth
          sx={{ mb: 2 }}
        />
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving..." : editingDonation ? "Save changes" : "Add donation"}
          </Button>
          {editingDonation && (
            <Button variant="text" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </Stack>
      </Paper>

      {!donationSummaries.length && (
        <Typography color="text.secondary">No donations logged yet. Add your first gift above.</Typography>
      )}

      {donationSummaries.map((summary) => (
        <Paper key={summary.year} variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
            <Typography variant="h6">{summary.year}</Typography>
            <Typography color="text.secondary">
              {summary.count} gift{summary.count === 1 ? "" : "s"} • {formatCurrency(summary.total)}
            </Typography>
          </Box>
          <Divider sx={{ mb: 1 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Note</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.donations.map((donation) => (
                <TableRow key={donation.id}>
                  <TableCell>{formatDate(donation.date)}</TableCell>
                  <TableCell>{formatCurrency(donation.amount)}</TableCell>
                  <TableCell>{donation.note || "—"}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                      <Button size="small" onClick={() => handleEdit(donation)}>
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleDelete(donation.id)}
                        disabled={deleteDonation.isPending}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ))}
    </Box>
  )
}
