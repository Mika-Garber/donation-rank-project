import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useOrganizationsQuery } from "../hooks/use-organizations-query"
import { useAdvisorExportStore } from "../store/use-advisor-export-store"
import type { Organization } from "../types/organization"
import {
  buildAdvisorExportCsv,
  buildAdvisorExportRowFromOrganization,
  buildAdvisorExportStats,
  downloadAdvisorExportCsv,
  getAdvisorExportWarnings,
  mergePersistedRowsWithOrganizations,
  type AdvisorExportRow,
} from "../utils/advisor-export"

interface AdvisorExportLocationState {
  organizationIds?: string[]
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`
}

function buildRowsFromOrganizations(organizations: Organization[]): AdvisorExportRow[] {
  return organizations
    .map((organization) => buildAdvisorExportRowFromOrganization(organization, true))
    .sort((left, right) => left.organizationName.localeCompare(right.organizationName))
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, mt: 0.5 }} variant="h5">
        {value}
      </Typography>
    </Paper>
  )
}

export function AdvisorExportPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const pendingOrganizationIds = useRef<string[] | null>(
    (location.state as AdvisorExportLocationState | null)?.organizationIds ?? null,
  )
  const { data: organizations = [], isLoading, isError } = useOrganizationsQuery()
  const rows = useAdvisorExportStore((state) => state.rows)
  const setRows = useAdvisorExportStore((state) => state.setRows)
  const clearRows = useAdvisorExportStore((state) => state.clearRows)
  const [excludeIncomplete, setExcludeIncomplete] = useState(false)
  const [hasHydrated, setHasHydrated] = useState(() => useAdvisorExportStore.persist.hasHydrated())
  const hasSyncedOrganizations = useRef(false)

  useEffect(() => {
    if (useAdvisorExportStore.persist.hasHydrated()) {
      setHasHydrated(true)
      return
    }

    return useAdvisorExportStore.persist.onFinishHydration(() => {
      setHasHydrated(true)
    })
  }, [])

  useEffect(() => {
    if (!hasHydrated || organizations.length === 0) return

    if (!hasSyncedOrganizations.current) {
      hasSyncedOrganizations.current = true
      setRows((currentRows) => mergePersistedRowsWithOrganizations(currentRows, organizations))
    }

    if (!pendingOrganizationIds.current) return

    const organizationIds = new Set(pendingOrganizationIds.current)
    pendingOrganizationIds.current = null
    setRows((currentRows) => {
      const existingIds = new Set(currentRows.map((row) => row.organizationId))
      const additions = buildRowsFromOrganizations(
        organizations.filter(
          (organization) => organizationIds.has(organization.id) && !existingIds.has(organization.id),
        ),
      )
      return mergePersistedRowsWithOrganizations([...currentRows, ...additions], organizations)
    })
    navigate(location.pathname, { replace: true, state: null })
  }, [hasHydrated, organizations, location.pathname, navigate, setRows])

  const availableToAdd = useMemo(() => {
    const listedIds = new Set(rows.map((row) => row.organizationId))
    return organizations
      .filter((organization) => !listedIds.has(organization.id))
      .sort((left, right) => left.organizationName.localeCompare(right.organizationName))
  }, [organizations, rows])

  const stats = useMemo(() => buildAdvisorExportStats(rows), [rows])

  function handleAddOrganization(organizationId: string): void {
    const organization = organizations.find((entry) => entry.id === organizationId)
    if (!organization) return
    setRows((currentRows) => {
      if (currentRows.some((row) => row.organizationId === organizationId)) return currentRows
      return [...currentRows, buildAdvisorExportRowFromOrganization(organization, true)].sort((left, right) =>
        left.organizationName.localeCompare(right.organizationName),
      )
    })
  }

  function handleRemoveOrganization(organizationId: string): void {
    setRows((currentRows) => currentRows.filter((row) => row.organizationId !== organizationId))
  }

  function updateRow(organizationId: string, patch: Partial<AdvisorExportRow>): void {
    setRows((currentRows) =>
      currentRows.map((row) => (row.organizationId === organizationId ? { ...row, ...patch } : row)),
    )
  }

  function handleDownloadCsv(): void {
    const csv = buildAdvisorExportCsv(rows, excludeIncomplete)
    const dateStamp = new Date().toISOString().slice(0, 10)
    downloadAdvisorExportCsv(csv, `advisor-donation-list-${dateStamp}.csv`)
  }

  function handleOpenPrintView(): void {
    const exportRows = rows.filter((row) => {
      if (excludeIncomplete && getAdvisorExportWarnings(row).length > 0) return false
      return true
    })
    navigate("/print/advisor-export", {
      state: {
        rows: exportRows,
        generatedAt: new Date().toISOString(),
      },
    })
  }

  if (isLoading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography>Loading advisor export...</Typography>
      </Box>
    )
  }

  if (isError) {
    return <Alert severity="error">Could not load advisor export data.</Alert>
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Paper sx={{ p: { md: 4, xs: 3 } }}>
        <Typography gutterBottom variant="h3">
          Advisor Export
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 820, mt: 1.5 }}>
          This export is for the financial advisor to cut and mail donation checks. It only includes donation
          amounts, payee names, and mailing addresses. It does not include ranking or research details.
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5 }} variant="body2">
          Your donation list is saved automatically. Add charities one by one, or load the suggested final list from
          the Final 15–20 Plan page.
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 2 }}>
          <Button component={Link} to="/portfolio-concentration" variant="outlined">
            Final 15–20 Plan
          </Button>
          <Button disabled={rows.length === 0} onClick={handleDownloadCsv} variant="contained">
            Download CSV
          </Button>
          <Button disabled={rows.length === 0} onClick={handleOpenPrintView} variant="outlined">
            Print / Save PDF
          </Button>
          <Button color="error" disabled={rows.length === 0} onClick={clearRows} variant="outlined">
            Clear all
          </Button>
        </Box>
      </Paper>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { md: "repeat(4, minmax(0, 1fr))", xs: "1fr" } }}>
        <StatCard label="Donations in list" value={String(stats.selectedCount)} />
        <StatCard label="Total donation amount" value={formatCurrency(stats.totalDonationAmount)} />
        <StatCard label="Missing addresses" value={String(stats.missingAddressCount)} />
        <StatCard label="Missing donation amounts" value={String(stats.missingDonationAmountCount)} />
      </Box>

      <Paper sx={{ p: { md: 3, xs: 2.5 } }}>
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="h5">Donation list</Typography>
          <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 2 }}>
            {availableToAdd.length > 0 ? (
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel id="add-charity-label">Add charity</InputLabel>
                <Select
                  labelId="add-charity-label"
                  label="Add charity"
                  value=""
                  onChange={(event) => {
                    handleAddOrganization(event.target.value)
                  }}
                >
                  {availableToAdd.map((organization) => (
                    <MenuItem key={organization.id} value={organization.id}>
                      {organization.organizationName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            <FormControlLabel
              control={
                <Checkbox checked={excludeIncomplete} onChange={(event) => setExcludeIncomplete(event.target.checked)} />
              }
              label="Exclude incomplete rows from export"
            />
          </Box>
        </Box>
        {rows.length === 0 ? (
          <Typography color="text.secondary">
            No charities in the donation list yet. Use Add charity above, or go to Final 15–20 Plan and click Load
            into donation list.
          </Typography>
        ) : (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ left: 0, position: "sticky", zIndex: 1, backgroundColor: "background.paper", minWidth: 220 }}>
                    Organization
                  </TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Check payee</TableCell>
                  <TableCell>Address line 1</TableCell>
                  <TableCell>Address line 2</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>ZIP</TableCell>
                  <TableCell>EIN</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Warnings</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const warnings = getAdvisorExportWarnings(row)
                  return (
                    <TableRow key={row.organizationId} hover>
                      <TableCell
                        sx={{ left: 0, position: "sticky", zIndex: 1, backgroundColor: "background.paper", minWidth: 220 }}
                      >
                        <Box sx={{ alignItems: "flex-start", display: "flex", flexDirection: "column", gap: 0.5 }}>
                          <Typography sx={{ fontWeight: 600 }}>{row.organizationName}</Typography>
                          <Button
                            color="error"
                            onClick={() => handleRemoveOrganization(row.organizationId)}
                            size="small"
                            sx={{ alignSelf: "flex-start", minWidth: 0, px: 0 }}
                            type="button"
                            variant="text"
                          >
                            Remove
                          </Button>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ minWidth: 110 }}>
                        <TextField
                          slotProps={{ htmlInput: { min: 0, step: 1 } }}
                          size="small"
                          type="number"
                          value={row.donationAmount}
                          onChange={(event) =>
                            updateRow(row.organizationId, {
                              donationAmount: Number.parseFloat(event.target.value) || 0,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <TextField
                          size="small"
                          value={row.checkPayeeName}
                          onChange={(event) => updateRow(row.organizationId, { checkPayeeName: event.target.value })}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <TextField
                          size="small"
                          value={row.addressLine1}
                          onChange={(event) => updateRow(row.organizationId, { addressLine1: event.target.value })}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField
                          size="small"
                          value={row.addressLine2}
                          onChange={(event) => updateRow(row.organizationId, { addressLine2: event.target.value })}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          size="small"
                          value={row.city}
                          onChange={(event) => updateRow(row.organizationId, { city: event.target.value })}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 80 }}>
                        <TextField
                          size="small"
                          value={row.state}
                          onChange={(event) => updateRow(row.organizationId, { state: event.target.value })}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 100 }}>
                        <TextField
                          size="small"
                          value={row.zip}
                          onChange={(event) => updateRow(row.organizationId, { zip: event.target.value })}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>{row.ein || "—"}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <TextField
                          size="small"
                          value={row.notes}
                          onChange={(event) => updateRow(row.organizationId, { notes: event.target.value })}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 220 }}>
                        {warnings.length > 0 ? (
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                            {warnings.map((warning) => (
                              <Chip color="warning" key={warning} label={warning} size="small" />
                            ))}
                          </Box>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  )
}
