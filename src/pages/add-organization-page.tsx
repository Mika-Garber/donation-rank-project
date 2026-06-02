import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from "@mui/material"
import { type FormEvent, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useCreateOrganizationMutation } from "../hooks/use-create-organization-mutation"

export function AddOrganizationPage() {
  const navigate = useNavigate()
  const createOrganizationMutation = useCreateOrganizationMutation()
  const [organizationName, setOrganizationName] = useState("")
  const [category, setCategory] = useState("Animal")
  const [subcategory, setSubcategory] = useState("")
  const [approximateAnnualDonation, setApproximateAnnualDonation] = useState("100")
  const [website, setWebsite] = useState("")
  const [notes, setNotes] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    await createOrganizationMutation.mutateAsync({
      organizationName,
      category,
      subcategory,
      approximateAnnualDonation: Number.parseFloat(approximateAnnualDonation) || 0,
      website,
      notes,
    })
    navigate("/")
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Add a new donation organization
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Keep this simple. You can start with basic details now and enrich data later.
      </Typography>

      {createOrganizationMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not save this organization. Please check required fields.
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
          <TextField select label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <MenuItem value="Animal">Animal</MenuItem>
            <MenuItem value="Nature">Nature</MenuItem>
            <MenuItem value="Alzheimers">Alzheimers</MenuItem>
            <MenuItem value="Veterans">Veterans</MenuItem>
            <MenuItem value="Science">Science</MenuItem>
            <MenuItem value="Political">Political</MenuItem>
          </TextField>
          <TextField
            label="Subcategory"
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
          <TextField label="Website (optional)" value={website} onChange={(event) => setWebsite(event.target.value)} />
          <TextField label="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} multiline rows={3} />
          <Button type="submit" variant="contained" disabled={createOrganizationMutation.isPending}>
            {createOrganizationMutation.isPending ? "Saving..." : "Save organization"}
          </Button>
        </Box>
      </Box>
    </Paper>
  )
}
