import { Box, Button, Grid, TextField } from "@mui/material"
import { useEffect, useState } from "react"
import { useUpdateOrganizationAddressMutation } from "../../hooks/use-donation-mutations"
import type { OrganizationAddress } from "../../types/organization"

interface OrganizationAddressFormProps {
  organizationId: string
  address: OrganizationAddress
}

export function OrganizationAddressForm({ organizationId, address }: OrganizationAddressFormProps) {
  const [form, setForm] = useState<OrganizationAddress>(address)
  const updateAddress = useUpdateOrganizationAddressMutation(organizationId)

  useEffect(() => {
    setForm(address)
  }, [address])

  function handleChange(field: keyof OrganizationAddress, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit() {
    updateAddress.mutate(form)
  }

  const formattedAddress = [form.street, form.city, form.state, form.postalCode, form.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ")

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {formattedAddress ? (
        <Box sx={{ color: "text.secondary" }}>{formattedAddress}</Box>
      ) : (
        <Box sx={{ color: "text.secondary" }}>No mailing address saved yet.</Box>
      )}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth
            label="Street address"
            value={form.street}
            onChange={(event) => handleChange("street", event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="City"
            value={form.city}
            onChange={(event) => handleChange("city", event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            fullWidth
            label="State"
            value={form.state}
            onChange={(event) => handleChange("state", event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            fullWidth
            label="ZIP"
            value={form.postalCode}
            onChange={(event) => handleChange("postalCode", event.target.value)}
          />
        </Grid>
      </Grid>
      <Box>
        <Button variant="contained" onClick={handleSubmit} disabled={updateAddress.isPending}>
          {updateAddress.isPending ? "Saving..." : "Save address"}
        </Button>
      </Box>
    </Box>
  )
}
