import { Box, Button, Typography } from "@mui/material"
import { Link, useLocation } from "react-router-dom"
import type { AdvisorExportRow } from "../utils/advisor-export"
import { buildAdvisorExportStats, formatAdvisorMailingAddress } from "../utils/advisor-export"
import "../styles/print.css"

interface AdvisorExportPrintState {
  rows: AdvisorExportRow[]
  generatedAt: string
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`
}

export function AdvisorExportPrintPage() {
  const location = useLocation()
  const state = location.state as AdvisorExportPrintState | null
  const rows = state?.rows ?? []
  const generatedAt = state?.generatedAt ? new Date(state.generatedAt).toLocaleString() : new Date().toLocaleString()
  const stats = buildAdvisorExportStats(rows, false)

  if (rows.length === 0) {
    return (
      <Box className="print-page">
        <Box className="print-toolbar no-print">
          <Button component={Link} to="/advisor-export" variant="outlined">
            Back to Advisor Export
          </Button>
        </Box>
        <Typography>No donation rows were provided for printing.</Typography>
      </Box>
    )
  }

  return (
    <Box className="print-page">
      <Box className="print-toolbar no-print">
        <Button component={Link} to="/advisor-export" variant="outlined">
          Back to Advisor Export
        </Button>
        <Button variant="contained" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </Box>

      <header className="print-header">
        <Typography className="print-title" variant="h4">
          Donation Instructions for Financial Advisor
        </Typography>
        <Typography color="text.secondary">Generated {generatedAt}</Typography>
      </header>

      <section className="print-section">
        <Box className="print-grid">
          <Typography>Number of donations: {stats.selectedCount}</Typography>
          <Typography>Total donation amount: {formatCurrency(stats.totalDonationAmount)}</Typography>
        </Box>
      </section>

      <section className="print-section">
        <table className="print-table">
          <thead>
            <tr>
              <th>Donation amount</th>
              <th>Check payee</th>
              <th>Mailing address</th>
              <th>EIN</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.organizationId}>
                <td>{formatCurrency(row.donationAmount)}</td>
                <td>{row.checkPayeeName || row.organizationName}</td>
                <td style={{ whiteSpace: "pre-line" }}>{formatAdvisorMailingAddress(row)}</td>
                <td>{row.ein || "—"}</td>
                <td>{row.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Box>
  )
}
