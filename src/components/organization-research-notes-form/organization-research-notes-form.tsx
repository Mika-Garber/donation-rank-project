import { Box, Button, TextField, Typography } from "@mui/material"
import { useEffect, useState } from "react"
import { useUpdateOrganizationResearchNotesMutation } from "../../hooks/use-organization-research-mutations"

interface OrganizationResearchNotesFormProps {
  organizationId: string
  impactEvidenceNotes: string
  accountabilityNotes: string
  politicalInvolvementNotes: string
}

export function OrganizationResearchNotesForm({
  organizationId,
  impactEvidenceNotes,
  accountabilityNotes,
  politicalInvolvementNotes,
}: OrganizationResearchNotesFormProps) {
  const [impactNotes, setImpactNotes] = useState(impactEvidenceNotes)
  const [accountability, setAccountability] = useState(accountabilityNotes)
  const [politicalNotes, setPoliticalNotes] = useState(politicalInvolvementNotes)
  const updateResearchNotes = useUpdateOrganizationResearchNotesMutation(organizationId)

  useEffect(() => {
    setImpactNotes(impactEvidenceNotes)
    setAccountability(accountabilityNotes)
    setPoliticalNotes(politicalInvolvementNotes)
  }, [impactEvidenceNotes, accountabilityNotes, politicalInvolvementNotes])

  function handleSave() {
    updateResearchNotes.mutate({
      impactEvidenceNotes: impactNotes,
      accountabilityNotes: accountability,
      politicalInvolvementNotes: politicalNotes,
    })
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography color="text.secondary">
        Add measurable outcomes here — animals rescued, adoptions, policy wins, dollar amounts, and report sources. The
        impact score looks for numbers with units (for example, “1,200 animals rescued”).
      </Typography>
      <TextField
        fullWidth
        multiline
        minRows={4}
        label="Impact evidence notes"
        value={impactNotes}
        onChange={(event) => setImpactNotes(event.target.value)}
        placeholder="Form 990 TY2024 Part III: 1,200 animals rescued; 850 adoptions. Source: annual report."
      />
      <TextField
        fullWidth
        multiline
        minRows={3}
        label="Accountability notes"
        value={accountability}
        onChange={(event) => setAccountability(event.target.value)}
      />
      <TextField
        fullWidth
        multiline
        minRows={3}
        label="Political or advocacy notes"
        value={politicalNotes}
        onChange={(event) => setPoliticalNotes(event.target.value)}
      />
      <Box>
        <Button variant="contained" onClick={handleSave} disabled={updateResearchNotes.isPending}>
          {updateResearchNotes.isPending ? "Saving..." : "Save research notes"}
        </Button>
      </Box>
    </Box>
  )
}
