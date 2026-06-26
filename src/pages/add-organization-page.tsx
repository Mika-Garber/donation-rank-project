import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from "@mui/material"
import { type FormEvent, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useCreateOrganizationMutation } from "../hooks/use-create-organization-mutation"
import type { MissionBucket } from "../types/organization"
import { useUiStore } from "../store/use-ui-store"

const MISSION_BUCKET_OPTIONS: Array<{ value: MissionBucket | "Needs classification"; label: string; category: string; subcategory: string }> = [
  { value: "Needs classification", label: "Needs classification", category: "Needs classification", subcategory: "" },
  { value: "Farm Animal Welfare", label: "Farm Animal Welfare", category: "Animal", subcategory: "Farm" },
  { value: "Animal Rescue / Shelters", label: "Animal Rescue / Shelters", category: "Animal", subcategory: "Rescue" },
  { value: "Wildlife / Conservation", label: "Wildlife / Conservation", category: "Nature", subcategory: "Conservation" },
  { value: "Animal Legal Advocacy", label: "Animal Legal Advocacy", category: "Animal", subcategory: "Legal advocacy" },
  { value: "Veterinary / Medical Animal Care", label: "Veterinary / Medical Animal Care", category: "Animal", subcategory: "Veterinary" },
  { value: "Alzheimer’s / Disease / Health", label: "Alzheimer’s / Disease / Health", category: "Alzheimers", subcategory: "Health" },
  { value: "Other", label: "Other", category: "Other", subcategory: "" },
]

export function AddOrganizationPage() {
  const navigate = useNavigate()
  const createOrganizationMutation = useCreateOrganizationMutation()
  const setShowOnlyTopTen = useUiStore((state) => state.setShowOnlyTopTen)
  const setRankingListFilter = useUiStore((state) => state.setRankingListFilter)
  const [organizationName, setOrganizationName] = useState("")
  const [ein, setEin] = useState("")
  const [website, setWebsite] = useState("")
  const [missionBucketSelection, setMissionBucketSelection] = useState<MissionBucket | "Needs classification">("Needs classification")
  const [subcategory, setSubcategory] = useState("")
  const [approximateAnnualDonation, setApproximateAnnualDonation] = useState("0")
  const [notes, setNotes] = useState("")
  const [savedOrganizationId, setSavedOrganizationId] = useState<string | null>(null)

  const selectedMissionOption =
    MISSION_BUCKET_OPTIONS.find((option) => option.value === missionBucketSelection) ?? MISSION_BUCKET_OPTIONS[0]

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const organization = await createOrganizationMutation.mutateAsync({
      organizationName,
      ein,
      website,
      category: selectedMissionOption.category,
      subcategory: subcategory.trim() || selectedMissionOption.subcategory,
      approximateAnnualDonation: Number.parseFloat(approximateAnnualDonation) || 0,
      notes,
    })
    setSavedOrganizationId(organization.id)
    setShowOnlyTopTen(false)
    setRankingListFilter(organization.rankingListKey)
  }

  function handleViewOnDashboard(): void {
    if (!savedOrganizationId) return
    navigate("/", { state: { focusOrganizationId: savedOrganizationId } })
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Add a new charity
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Start with basic details now. The charity will appear on the dashboard as not researched until you run free research on the Data Refresh page.
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Free research can verify IRS/990/watchdog/website data when available. Annual reports or impact PDFs may still need to be added manually if the app cannot find them online.
      </Alert>

      {createOrganizationMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not save this organization. Please check required fields.
        </Alert>
      )}

      {savedOrganizationId && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography sx={{ mb: 1 }}>Organization saved. It is marked as not researched until you run free research.</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Button variant="contained" size="small" onClick={handleViewOnDashboard}>
              View on dashboard
            </Button>
            <Button component={Link} to={`/organizations/${savedOrganizationId}`} variant="outlined" size="small">
              Open organization page
            </Button>
            <Button component={Link} to="/data-refresh" variant="outlined" size="small">
              Go to Data Refresh
            </Button>
          </Box>
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Organization name"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            required
          />
          <TextField
            label="EIN (optional)"
            value={ein}
            onChange={(event) => setEin(event.target.value)}
            placeholder="XX-XXXXXXX"
          />
          <TextField label="Website (optional)" value={website} onChange={(event) => setWebsite(event.target.value)} />
          <TextField
            select
            label="Mission bucket"
            value={missionBucketSelection}
            onChange={(event) => setMissionBucketSelection(event.target.value as MissionBucket | "Needs classification")}
          >
            {MISSION_BUCKET_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Subcategory (optional)"
            value={subcategory}
            onChange={(event) => setSubcategory(event.target.value)}
            placeholder="Dogs, Cats, Farm animals..."
          />
          <TextField
            label="Approximate annual donation"
            value={approximateAnnualDonation}
            onChange={(event) => setApproximateAnnualDonation(event.target.value)}
            type="number"
            slotProps={{ htmlInput: { min: 0 } }}
          />
          <TextField label="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} multiline rows={3} />
          <Button type="submit" variant="contained" disabled={createOrganizationMutation.isPending || Boolean(savedOrganizationId)}>
            {createOrganizationMutation.isPending ? "Saving..." : "Save organization"}
          </Button>
        </Box>
      </Box>
    </Paper>
  )
}
